/**
 * Who is allowed past the door.
 *
 * The decision is a pure function and the redirect is a thin wrapper around it,
 * so the rule can be tested without a request, a session or a database. This is
 * the only thing between the open internet and the admin.
 */

import type { Route } from "next";
import { redirect } from "next/navigation";
import { coerceRole, rolesAtOrAbove, ROLES, type Role } from "@saas/auth";

export type GuardDecision =
  | { readonly kind: "redirect"; readonly to: string }
  | { readonly kind: "forbidden"; readonly role: Role }
  | { readonly kind: "allow"; readonly role: Role };

export type GuardInput = {
  readonly session: { readonly userId: string } | null;
  readonly role: Role | null;
  readonly minimum: Role;
  readonly pathname: string;
};

/** Only somewhere on this site. An absolute URL here would be an open redirect. */
function safeNext(pathname: string): string | null {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  return pathname;
}

export function decideAccess({ session, role, minimum, pathname }: GuardInput): GuardDecision {
  if (session === null) {
    const next = safeNext(pathname);
    return {
      kind: "redirect",
      to: next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in",
    };
  }

  // A missing membership row means `customer` — signed in, but not staff.
  const actual = coerceRole(role);

  return rolesAtOrAbove(minimum).includes(actual)
    ? { kind: "allow", role: actual }
    : { kind: "forbidden", role: actual };
}

/**
 * The server-side wrapper. Returns the role on success so the caller does not
 * have to look it up again; throws Next's redirect otherwise.
 *
 * `forbidden` deliberately does NOT bounce to sign-in: the visitor is already
 * signed in, so that would loop forever. They get told no.
 */
export function enforceAccess(input: GuardInput): Role {
  const decision = decideAccess(input);

  /*
   * `typedRoutes` wants a literal it can check. The sign-in target carries the
   * path the visitor was reaching for, so it is built at run time — the cast
   * says "this is a route" once, here, instead of loosening the setting for the
   * whole app.
   */
  if (decision.kind === "redirect") redirect(decision.to as Route);
  if (decision.kind === "forbidden") redirect("/no-access" as Route);

  return decision.role;
}

export const MINIMUM_ADMIN_ROLE: Role = ROLES.staff;
