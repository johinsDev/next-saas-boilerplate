import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

import { PATHNAME_HEADER } from "@/lib/proxy-headers";

/**
 * The coarse gate: turn away anyone with no session cookie before we render a
 * thing.
 *
 * It checks for the cookie's *presence* and nothing else — no database, no
 * signature check, no session decode. That is the point. It runs on every
 * request, it may be deployed to the CDN, and Next warns against reaching for
 * shared modules here, so the expensive question belongs elsewhere.
 *
 * **A cookie is not a role.** This only knows that somebody is signed in, and
 * the product has customers as well as staff. The real decision — is this
 * person staff — is `verifyAuth()` in `auth-queries.ts`, which reads the
 * membership row. Two layers on purpose: this one keeps the signed-out from
 * ever reaching a render, that one keeps the signed-in-but-not-staff out of the
 * admin.
 *
 * `getSessionCookie` is Better Auth's own reader, so it already knows about the
 * `__Secure-` prefix in production and about `AUTH_COOKIE_PREFIX`. Hand-rolling
 * the cookie name here is how a deploy silently signs everybody out.
 */

/**
 * Reachable with no session.
 *
 * `/api/auth` is not optional: the OAuth and magic-link callbacks arrive
 * *before* a cookie exists. Redirect those and sign-in cannot complete at all —
 * the failure looks like "Google is broken", not like a proxy rule.
 */
const PUBLIC_PREFIXES = ["/sign-in", "/api/auth"] as const;

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  if (getSessionCookie(request, { cookiePrefix: process.env.AUTH_COOKIE_PREFIX })) {
    const headers = new Headers(request.headers);
    headers.set(PATHNAME_HEADER, `${pathname}${search}`);
    return NextResponse.next({ request: { headers } });
  }

  // Carry where they were heading, so signing in lands them there rather than
  // dumping them on the dashboard. `?next=` is validated again on the way out.
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(signIn);
}

export const config = {
  /*
   * Everything except Next's own assets and anything that looks like a file. A
   * missing exclusion here costs a proxy invocation per image, per font, per
   * chunk — on every page load.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
