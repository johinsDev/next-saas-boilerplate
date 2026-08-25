import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { coerceRole, type Role } from "@saas/auth";
import { db, schema } from "@saas/db";

import { enforceAccess, MINIMUM_ADMIN_ROLE, type GuardInput } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";

/**
 * Reads. `server-only` lives here rather than in `@saas/auth`, because that
 * guard is a Next construct and throws anywhere React is not — including the
 * Worker and a plain test run. This is where a client/server boundary actually
 * exists.
 */

export const VIEWER_TAG = "viewer";

export type Viewer = {
  readonly userId: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: Role;
  readonly organizationId: string | null;
  /**
   * The id of whoever is impersonating this account, or null.
   *
   * Read here rather than anywhere else because this is the one function that
   * sees the session row, and because the impersonation bar must never be able
   * to disagree with the session it is describing — a bar that has gone stale
   * is somebody acting on a colleague's account believing it is their own.
   */
  readonly impersonatedBy: string | null;
};

/**
 * The signed-in staff member, or null. Never throws — callers decide.
 *
 * This is the **only** function in the app allowed to read `cookies()`/
 * `headers()` inside a cache. `'use cache: private'` exists for exactly this: a
 * per-viewer read that cannot have its request data hoisted out, because the
 * request data *is* the input. Everything else that varies per viewer takes the
 * resolved id as an argument and uses plain `'use cache'` — the privacy comes
 * from the key, not from the directive.
 *
 * A private cache never reaches the server's store; it lives in that one
 * browser's memory and does not survive a reload. So this is not "the session
 * cached for everyone", which would be a catastrophe — it is this viewer's own
 * lookup, not repeated once per component that needs to know who they are.
 */
export async function getViewer(): Promise<Viewer | null> {
  "use cache: private";
  /*
   * A minute, not forever. Roles change, and impersonation is a normal admin
   * feature — a stale answer there means acting on a record believing you are
   * yourself. The tag lets a role change or an impersonation refresh it at once
   * rather than waiting the minute out.
   */
  cacheLife({ stale: 60 });
  cacheTag(VIEWER_TAG);

  // `headers()` is async in Next 16; synchronous access was removed.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const [row] = await db
    .select({ role: schema.member.role, organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, session.user.id))
    .limit(1);

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    // No membership row means `customer` — signed in, but not staff.
    role: coerceRole(row?.role),
    organizationId: row?.organizationId ?? null,
    impersonatedBy: session.session.impersonatedBy ?? null,
  };
}

/**
 * The signed-in staff member, or a redirect. Uncached on purpose: `redirect()`
 * works by throwing, and a thrown control-flow signal has no business being
 * stored in a cache entry.
 *
 * `proxy.ts` already turned away anyone with no session cookie, but a cookie is
 * not a role. Only this check knows whether the holder is staff, so it is the
 * one that actually decides.
 */
export async function verifyAuth(pathname: string, minimum: Role = MINIMUM_ADMIN_ROLE) {
  const viewer = await getViewer();

  const input: GuardInput = {
    session: viewer ? { userId: viewer.userId } : null,
    role: viewer?.role ?? null,
    minimum,
    pathname,
  };

  // Throws a redirect unless the viewer clears the bar.
  enforceAccess(input);

  // Non-null: `enforceAccess` redirects when `session` is null.
  return viewer as Viewer;
}
