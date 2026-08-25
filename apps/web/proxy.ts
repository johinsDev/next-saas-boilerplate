import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

import { PATHNAME_HEADER } from "@/lib/proxy-headers";

/**
 * The customer app is **public by default**, and that inverts the admin's rule.
 *
 * In `apps/admin` the proxy guards everything and lists the exceptions. Here it
 * guards almost nothing: a marketing page, a shared link, a page an anonymous
 * visitor should be able to read must never bounce to sign-in. So the matcher
 * names the protected segment instead of excluding the public one — a
 * deny-list on the admin, an allow-list here.
 *
 * Get this backwards and the symptom is not a security hole, it is an app that
 * is invisible to anyone who is not already a customer, which no one notices
 * until search engines and shared links quietly stop working.
 *
 * As in the admin, this only checks the cookie is *present*. Whether the
 * visitor may see a particular page is `verifyAuth()`, in the data layer.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (getSessionCookie(request, { cookiePrefix: process.env.AUTH_COOKIE_PREFIX })) {
    const headers = new Headers(request.headers);
    headers.set(PATHNAME_HEADER, `${pathname}${search}`);
    return NextResponse.next({ request: { headers } });
  }

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(signIn);
}

export const config = {
  /*
   * The protected segment, named explicitly. Everything else — the home page,
   * anything public, and `/api/auth` where the sign-in callbacks land — never
   * reaches this function at all.
   */
  matcher: ["/account/:path*"],
};
