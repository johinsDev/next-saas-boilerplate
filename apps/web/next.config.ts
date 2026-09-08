import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@saas/ui", "@saas/auth", "@saas/db", "@saas/services"],
  typedRoutes: true,
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: { position: "bottom-right" },
};

/**
 * Sentry wraps the config rather than living in it, because it needs build-time
 * hooks (source-map upload, the tunnel route) that plain config cannot express.
 *
 * Everything here is inert without credentials: with no `SENTRY_AUTH_TOKEN`
 * the upload is skipped, and with no DSN the SDK never initialises. A clone
 * with no Sentry account builds exactly as it did before.
 */
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Route browser reports through the app's own origin so ad blockers, which
  // block Sentry's domain by default, do not silently drop the errors of the
  // users most likely to be having them.
  tunnelRoute: true,
  telemetry: false,
});
