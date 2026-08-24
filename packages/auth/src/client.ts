import {
  adminClient,
  magicLinkClient,
  organizationClient,
  phoneNumberClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Auth lives on the standalone Cloudflare Worker (`api.t4diverclub.app`). The
 * front-ends are thin clients: every environment sets `NEXT_PUBLIC_API_URL`
 * (dev `localhost:8787`, preview per-PR, prod), so the client always points
 * cross-origin at the Worker and sends credentials. There is no same-origin
 * `/api/auth/*` fallback anymore.
 */
const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: { credentials: "include" },
  plugins: [
    organizationClient(),
    phoneNumberClient(),
    magicLinkClient(),
    adminClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
