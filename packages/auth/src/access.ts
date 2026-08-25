import { coerceRole, ROLES, rolesAtOrAbove, type Role } from "./roles";

/**
 * Who is allowed past the door — the decision, with nothing framework-shaped
 * about it.
 *
 * It lives here rather than in an app because both `apps/web` and `apps/admin`
 * ask the same question with a different bar, and a security rule copied into
 * two places is a security rule that drifts. What stays in each app is the
 * thing that cannot be shared: the redirect, which is a Next construct.
 */

export type GuardDecision =
  | { readonly kind: "redirect"; readonly to: string }
  | { readonly kind: "forbidden"; readonly role: Role }
  | { readonly kind: "allow"; readonly role: Role };

export type GuardInput = {
  readonly session: { readonly userId: string } | null;
  readonly role: Role | null;
  /** The lowest role that may pass. `customer` means "any signed-in visitor". */
  readonly minimum: Role;
  /** Where the visitor was heading, so sign-in can send them back. */
  readonly pathname: string;
  /** Where to send an anonymous visitor. Apps differ; web has its own route. */
  readonly signInPath?: string;
};

/** Only somewhere on this site. An absolute URL here would be an open redirect. */
function safeNext(pathname: string): string | null {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  return pathname;
}

export function decideAccess({
  session,
  role,
  minimum,
  pathname,
  signInPath = "/sign-in",
}: GuardInput): GuardDecision {
  if (session === null) {
    const next = safeNext(pathname);
    return {
      kind: "redirect",
      to: next ? `${signInPath}?next=${encodeURIComponent(next)}` : signInPath,
    };
  }

  // A missing membership row means `customer` — signed in, but not staff.
  const actual = coerceRole(role);

  /*
   * `customer` is not an operator role, and `rolesAtOrAbove` deliberately only
   * returns operator roles — reading its list as "everyone at or above this"
   * would lock every customer out of the customer app, which is the bug this
   * branch exists to prevent. A `customer` bar means "signed in at all", and we
   * already know the session is not null by here.
   */
  if (minimum === ROLES.customer) return { kind: "allow", role: actual };

  return rolesAtOrAbove(minimum).includes(actual)
    ? { kind: "allow", role: actual }
    : { kind: "forbidden", role: actual };
}
