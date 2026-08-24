// Public API of @saas/rate-limit.
// See .claude/skills/rate-limit/SKILL.md for the full handbook.

export {
  MissingDependencyError,
  ProviderError,
  RateLimitError,
} from "./errors";
export { FakeLimiter } from "./fake-limiter";
export { RateLimiter } from "./manager";
export { MemoryProvider, RedisProvider, UpstashProvider } from "./providers";
export { parseDuration } from "./types";
export type {
  Duration,
  MemoryProviderConfig,
  ProviderConfig,
  RateLimiterConfig,
  RateLimitLogger,
  RateLimitLogLevel,
  RateLimitProvider,
  RateLimitResult,
  RateLimitRule,
  RedisProviderConfig,
  UpstashProviderConfig,
} from "./types";
