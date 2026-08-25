/**
 * The paths `proxy.ts` lets through without a session.
 *
 * Extracted from the proxy so it can be tested without a request: the list is
 * short, and getting it wrong has a failure mode that does not look like a
 * proxy bug at all.
 */
export const PUBLIC_PREFIXES = ["/sign-in", "/api/auth"] as const;

export function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
