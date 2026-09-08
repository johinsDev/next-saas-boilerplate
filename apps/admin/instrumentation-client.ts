import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "./sentry.shared";

Sentry.init({
  ...sentryOptions,
  // Session replay and the browser tracing integration are left out on
  // purpose: both are heavy, and neither earns its bundle cost before there is
  // a real user whose problem needs reproducing.
  integrations: [],
});

/** Required for `router.push()` navigations to appear as transactions. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
