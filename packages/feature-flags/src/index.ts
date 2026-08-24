// Shared, environment-agnostic API of @saas/feature-flags.
// Server-only types/factories: `@saas/feature-flags/server`.
// Browser-only types/factories: `@saas/feature-flags/client`.
// React provider + hooks:       `@saas/feature-flags/react`.
// See .claude/skills/feature-flags/SKILL.md for the full handbook.

export {
  FeatureFlagsError,
  MissingDependencyError,
  ProviderError,
} from "./errors";

export type {
  Flags,
  FlagsBinding,
  FlagsLogger,
  FlagsStrategy,
  FlagKey,
  FlagValue,
  NullProviderConfig,
  PostHogProviderConfig,
  ProviderConfig,
} from "./types";
