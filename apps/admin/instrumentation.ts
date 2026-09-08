import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "./sentry.shared";

/**
 * Server and edge runtimes. Next calls this once per runtime at boot.
 */
export function register() {
  Sentry.init(sentryOptions);
}

/**
 * Next hands nested React Server Component errors here; without it they are
 * swallowed by the framework's own boundary and never reach Sentry.
 */
export const onRequestError = Sentry.captureRequestError;
