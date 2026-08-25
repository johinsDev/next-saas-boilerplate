/**
 * The Next-shaped half of the door.
 *
 * The decision itself is `decideAccess` in `@saas/auth` — pure, shared with
 * `apps/web`, and tested there. What cannot be shared is the redirect:
 * `redirect()` is a Next construct that works by throwing.
 */

import type { Route } from "next";
import { redirect } from "next/navigation";
import { decideAccess, ROLES, type GuardInput, type Role } from "@saas/auth";

export type { GuardInput };

/**
 * Returns the role on success so the caller does not have to look it up again;
 * throws Next's redirect otherwise.
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
