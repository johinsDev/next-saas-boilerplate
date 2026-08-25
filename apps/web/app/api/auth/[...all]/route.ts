import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

/**
 * Better Auth's own endpoints. The browser talks to these directly — never to a
 * Server Function — which is the transport the architecture guard asks for.
 */
export const { GET, POST } = toNextJsHandler(auth.handler);
