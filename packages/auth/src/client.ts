import {
  adminClient,
  magicLinkClient,
  organizationClient,
  phoneNumberClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser client for the Next apps.
 *
 * **Same-origin by default.** Each app mounts Better Auth itself at
 * `app/api/auth/[...all]/route.ts` and builds its own instance with its own
 * `baseURL`, so the endpoints live on the app's own origin. Leaving `baseURL`
 * unset lets Better Auth resolve `/api/auth` against the current origin, which
 * is the only value that is correct for every app, port and preview URL at
 * once.
 *
 * (This used to point unconditionally at `NEXT_PUBLIC_API_URL ?? localhost:8787`
 * — the Cloudflare Worker. The Worker serves no auth routes, so every sign-in
 * posted into the void. The comment describing a standalone Worker issuer
 * survived the extraction; the deployment topology it described did not.)
 *
 * Set `NEXT_PUBLIC_AUTH_URL` only when auth genuinely lives on another origin.
 * Doing so also requires that origin in the server's `trustedOrigins`.
 */
const baseURL = process.env.NEXT_PUBLIC_AUTH_URL;

export const authClient = createAuthClient({
  ...(baseURL && { baseURL }),
  // Only meaningful cross-origin; harmless same-origin, and it keeps a
  // deployment that does split the origins from silently dropping the cookie.
  fetchOptions: { credentials: "include" },
  plugins: [
    organizationClient(),
    phoneNumberClient(),
    magicLinkClient(),
    adminClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
