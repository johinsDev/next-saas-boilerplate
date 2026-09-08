/**
 * One Sentry configuration for all three runtimes of this app.
 *
 * Deliberately not a `packages/sentry` abstraction: Sentry's own SDKs are
 * already the platform abstraction, they differ per runtime in ways a wrapper
 * would have to leak, and every wrapper between an error and its report is a
 * place the report can be lost.
 *
 * **Inert without a DSN.** `Sentry.init` with an empty DSN is a documented
 * no-op, so a clone with no Sentry account runs, builds and tests exactly as
 * before. That is the point: nothing here should be a prerequisite for working
 * on the app.
 */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  // Sampled, not exhaustive: traces are the expensive signal and full capture
  // buys little once a pattern is visible. Errors are always captured.
  tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.1 : 1,
  // Never enable in development. It reports every local mistake into the same
  // project as production and makes the real signal unreadable.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
} as const;
