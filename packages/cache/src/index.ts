// Public API of @saas/cache.
// See .claude/skills/cache/SKILL.md for the full handbook.

export { CacheStore } from "./cache-store";
export {
  CacheError,
  MissingDependencyError,
  ProviderError,
} from "./errors";
export { FakeStore } from "./fake-store";
export { CacheManager } from "./manager";
export {
  MemoryProvider,
  RedisProvider,
  UpstashProvider,
} from "./providers";
export type {
  CacheLogger,
  CacheLogLevel,
  CacheManagerConfig,
  CacheProvider,
  MemoryProviderConfig,
  ProviderConfig,
  RedisProviderConfig,
  UpstashProviderConfig,
} from "./types";
