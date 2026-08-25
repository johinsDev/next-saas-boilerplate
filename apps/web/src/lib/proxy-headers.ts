/**
 * The channel from `proxy.ts` to the render.
 *
 * A Server Component cannot see its own pathname, and the case that needs it is
 * real: the session cookie is present but the session behind it expired, so the
 * proxy waves the request through and the layout is the one that has to send
 * the visitor to sign-in. Without this it can only guess where they were going.
 * Headers are the channel Next documents for exactly this.
 *
 * It lives in its own module because `proxy.ts` runs in a stripped-down runtime
 * that may be deployed to the CDN. A bare string constant is safe to share; an
 * import that drags in the database or the auth instance is not.
 */
export const PATHNAME_HEADER = "x-saas-pathname";
