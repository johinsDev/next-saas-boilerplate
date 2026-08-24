// Shared, environment-agnostic API of @saas/analytics.
// Server-only types/factories: `@saas/analytics/server`.
// Browser-only types/factories: `@saas/analytics/client`.
// React provider + hook:        `@saas/analytics/react`.
// See .claude/skills/analytics/SKILL.md for the full handbook.

export {
  AnalyticsError,
  MissingDependencyError,
  ProviderError,
} from "./errors";

export type {
  Analytics,
  AnalyticsBinding,
  AnalyticsEvent,
  AnalyticsLogger,
  AnalyticsStrategy,
  BaseProperties,
  EventProperties,
  NullProviderConfig,
  PostHogProviderConfig,
  ProviderConfig,
} from "./types";
