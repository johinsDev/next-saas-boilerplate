"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ALL_ROLES, ROLES, type Role } from "@saas/auth/roles";
import { getPrimaryOrganizationId, recordAudit } from "@saas/db";
import { changeUserRole, getUser, inviteUser } from "@saas/services/users";
import { ServiceError, isServiceError } from "@saas/services";

import { VIEWER_TAG } from "@/features/auth/auth-queries";
import { verifyAuth } from "@/features/auth/auth-queries";
import { auth } from "@/lib/auth";
import { USERS_TAG } from "./users-queries";

/**
 * Everything the roster can do to somebody.
 *
 * Two rules run through all of it.
 *
 * **Owner only.** Not because a manager could not be trusted with a role
 * change, but because Better Auth's `admin` plugin gates ban, session
 * revocation and impersonation on `user.role === "admin"`, which only the owner
 * carries. Guarding some of these at manager level would produce a screen whose
 * buttons work or 403 depending on which one you pressed.
 *
 * **`updateTag`, not `revalidateTag`.** These are the actor's own writes and
 * they are looking straight at the result — read-your-own-writes is exactly
 * what `updateTag` is for. `revalidateTag(tag, 'max')` belongs in route
 * handlers and for data somebody *else* is waiting on.
 */

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Owner, and their own id.
 *
 * The path is `/staff` rather than the caller's: an action has no pathname of
 * its own, and the guard only uses it to build the sign-in return URL. Sending
 * somebody back to a roster after signing in is the right answer anyway.
 */
async function requireOwner() {
  return verifyAuth("/staff", ROLES.owner);
}

/**
 * The organization every membership hangs off.
 *
 * `getPrimaryOrganizationId` is nullable because an unseeded database has no
 * organization at all. That is not a case to paper over with a fallback id: a
 * membership pointing at an organization that does not exist would satisfy the
 * types and grant nothing. `bun run db:seed:owner` is what fixes it.
 */
async function primaryOrganizationId(): Promise<string> {
  const id = await getPrimaryOrganizationId();
  if (!id) {
    throw new ServiceError({
      code: "INTERNAL_SERVER_ERROR",
      message: "No organization has been created yet. Run `bun run db:seed:owner <email>`.",
    });
  }
  return id;
}

function failed(error: unknown, fallback: string): ActionResult {
  // A service error carries a message written for a person. Anything else is
  // ours to keep quiet about — an exception's text is not a UI string.
  if (isServiceError(error)) return { ok: false, message: error.message };
  // Swallowing this would leave a failed role change with no trace anywhere:
  // the caller only ever sees `fallback`, which by design says nothing.
  // oxlint-disable-next-line no-console
  console.error(fallback, error);
  return { ok: false, message: fallback };
}

/** Refreshes the roster and, when the change could be about the actor, the viewer chip. */
function refresh(alsoViewer = false) {
  updateTag(USERS_TAG);
  if (alsoViewer) updateTag(VIEWER_TAG);
}

export async function setUserRoleAction(userId: string, role: Role): Promise<ActionResult> {
  const actor = await requireOwner();

  if (!ALL_ROLES.includes(role)) return { ok: false, message: "That is not a role." };

  /*
   * The owner cannot demote themselves. Not paternalism: they are the only
   * account carrying the admin-plugin capability flag, so a self-demotion
   * leaves nobody able to ban, revoke or impersonate — recoverable only by
   * re-running the seed from a terminal.
   */
  if (userId === actor.userId && role !== ROLES.owner) {
    return { ok: false, message: "You cannot demote yourself — you are the only owner." };
  }

  try {
    const organizationId = await primaryOrganizationId();
    const change = await changeUserRole({ userId, role, organizationId });

    // Nothing happened, so nothing is recorded. An audit entry saying "role
    // changed" against a no-op is worse than no entry.
    if (change.kind !== "none") {
      await recordAudit({
        organizationId,
        actorUserId: actor.userId,
        targetUserId: userId,
        type: change.kind === "remove" ? "disable" : "role_change",
        metadata: { role, change: change.kind },
      });
    }

    refresh(userId === actor.userId);
    return { ok: true };
  } catch (error) {
    return failed(error, "Could not change that role.");
  }
}

export async function banUserAction(userId: string, reason: string): Promise<ActionResult> {
  const actor = await requireOwner();

  if (userId === actor.userId) {
    return { ok: false, message: "You cannot disable your own account." };
  }

  try {
    // The plugin's own endpoint, not a column write: banning also revokes the
    // sessions the account already holds, and doing that correctly is the whole
    // reason to go through it.
    await auth.api.banUser({
      body: { userId, banReason: reason.trim() || undefined },
      headers: await headers(),
    });

    await recordAudit({
      organizationId: await getPrimaryOrganizationId(),
      actorUserId: actor.userId,
      targetUserId: userId,
      type: "disable",
      metadata: { reason: reason.trim() || null },
    });

    refresh();
    return { ok: true };
  } catch (error) {
    return failed(error, "Could not disable that account.");
  }
}

export async function unbanUserAction(userId: string): Promise<ActionResult> {
  const actor = await requireOwner();

  try {
    await auth.api.unbanUser({ body: { userId }, headers: await headers() });

    await recordAudit({
      organizationId: await getPrimaryOrganizationId(),
      actorUserId: actor.userId,
      targetUserId: userId,
      type: "enable",
    });

    refresh();
    return { ok: true };
  } catch (error) {
    return failed(error, "Could not re-enable that account.");
  }
}

export async function revokeSessionsAction(userId: string): Promise<ActionResult> {
  const actor = await requireOwner();

  try {
    await auth.api.revokeUserSessions({ body: { userId }, headers: await headers() });

    await recordAudit({
      organizationId: await getPrimaryOrganizationId(),
      actorUserId: actor.userId,
      targetUserId: userId,
      type: "session_revoke",
    });

    refresh(userId === actor.userId);
    return { ok: true };
  } catch (error) {
    return failed(error, "Could not revoke those sessions.");
  }
}

/**
 * Become somebody else.
 *
 * Redirects rather than returning, because the session cookie has just changed
 * underneath the caller: staying on the roster would render it as the person
 * being impersonated, who in most cases cannot see it. The dashboard is
 * somewhere everybody can be.
 */
export async function impersonateAction(userId: string): Promise<ActionResult> {
  const actor = await requireOwner();

  if (userId === actor.userId) {
    return { ok: false, message: "You are already yourself." };
  }

  try {
    await auth.api.impersonateUser({ body: { userId }, headers: await headers() });

    await recordAudit({
      organizationId: await getPrimaryOrganizationId(),
      actorUserId: actor.userId,
      targetUserId: userId,
      type: "impersonation_start",
    });
  } catch (error) {
    return failed(error, "Could not impersonate that account.");
  }

  // Outside the try: `redirect` works by throwing, and catching it here would
  // report a successful impersonation as a failure.
  updateTag(USERS_TAG);
  updateTag(VIEWER_TAG);
  redirect("/dashboard");
}

/**
 * Stop impersonating. Deliberately **not** owner-guarded.
 *
 * While impersonating you are the other person, so an owner check would fail
 * for exactly the session that needs this — the way out has to be reachable
 * from inside. Better Auth only restores a session that was impersonating in
 * the first place, so there is nothing here to abuse.
 */
export async function stopImpersonatingAction(): Promise<void> {
  try {
    await auth.api.stopImpersonating({ headers: await headers() });
  } catch (error) {
    // Logged and swallowed on purpose: the redirect below has to happen either
    // way. Leaving somebody stuck inside an impersonated session because the
    // teardown failed is worse than a stale cookie they can sign out of.
    // oxlint-disable-next-line no-console
    console.error("Could not stop impersonating", error);
  }

  updateTag(VIEWER_TAG);
  updateTag(USERS_TAG);
  // The staff roster, not wherever they were: while impersonating, "wherever
  // they were" is often a page the impersonated account can see and the owner
  // has no reason to be on.
  redirect("/staff");
}

export async function inviteUserAction(input: {
  email: string;
  name: string;
  role: Role;
}): Promise<ActionResult> {
  const actor = await requireOwner();

  try {
    const organizationId = await primaryOrganizationId();
    const { userId } = await inviteUser({
      email: input.email,
      name: input.name.trim() || null,
      role: input.role,
      organizationId,
    });

    /*
     * The account exists before the link is sent, and that ordering is the
     * whole design: `magicLink` runs with `disableSignUp: true`, so a link to
     * an address with no account is refused on redemption. Creating the row
     * first turns the magic link into the acceptance step — no second table, no
     * accept page, and "invited" stays a derived state rather than a record
     * that can disagree with reality.
     */
    await auth.api.signInMagicLink({
      body: { email: input.email.trim().toLowerCase(), callbackURL: "/dashboard" },
      headers: await headers(),
    });

    await recordAudit({
      organizationId,
      actorUserId: actor.userId,
      targetUserId: userId,
      type: "invite_sent",
      metadata: { role: input.role },
    });

    refresh();
    return { ok: true };
  } catch (error) {
    return failed(error, "Could not send that invitation.");
  }
}

/**
 * Send the sign-in link again.
 *
 * Exists because the roster's menu would otherwise offer an invited account
 * "Revoke sessions" and "Sign in as this person" — one with nothing to revoke,
 * the other showing you an account nobody has ever set up. Resending is the
 * only thing anybody actually wants to do to somebody who has not arrived yet.
 *
 * Refuses once the address is verified rather than quietly sending anyway: at
 * that point the account works, and a "resend" that arrives after somebody has
 * already signed in reads as a security event.
 */
export async function resendInvitationAction(userId: string): Promise<ActionResult> {
  const actor = await requireOwner();

  try {
    const user = await getUser(userId);

    if (!user?.email) {
      return { ok: false, message: "That account has no address to send to." };
    }

    if (user.status !== "invited") {
      return { ok: false, message: "They have already signed in — nothing to resend." };
    }

    await auth.api.signInMagicLink({
      body: { email: user.email, callbackURL: "/dashboard" },
      headers: await headers(),
    });

    await recordAudit({
      organizationId: await primaryOrganizationId(),
      actorUserId: actor.userId,
      targetUserId: userId,
      type: "invite_sent",
      metadata: { resend: true },
    });

    // No `refresh()`: nothing about the roster changed. They were invited
    // before and they are invited now.
    return { ok: true };
  } catch (error) {
    return failed(error, "Could not resend that invitation.");
  }
}
