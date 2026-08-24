/**
 * Low-level cache driver interface every provider implements.
 * Providers handle raw string storage only — the `CacheStore`
 * layer above adds JSON serialization, the `getOrSet` helper,
 * and structured logging.
 *
 * Keep new methods narrow: a single semantic operation per
 * call, no batch primitives unless every provider has a native
 * batch op (Upstash + ioredis both do; the memory provider
 * fakes it with a loop).
 */
export interface CacheProvider {
  readonly name: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  flush(): Promise<void>;
  /** Optional — only network-backed providers need to clean up. */
  disconnect?(): Promise<void>;
}

export interface MemoryProviderConfig {
  provider: "memory";
}

export interface UpstashProviderConfig {
  provider: "upstash";
  /** Optional explicit URL; otherwise `Redis.fromEnv()` is used. */
  url?: string;
  /** Optional explicit token; otherwise `Redis.fromEnv()` is used. */
  token?: string;
}

export interface RedisProviderConfig {
  provider: "redis";
  /** Standard `redis://` or `rediss://` URL. */
  url: string;
}

export type ProviderConfig =
  | MemoryProviderConfig
  | UpstashProviderConfig
  | RedisProviderConfig;

/**
 * Structural type of the slice of `@saas/log`'s `Logger` the
 * cache uses. Kept narrow so swapping loggers (or passing a fake)
 * doesn't drag the whole package surface.
 */
export interface CacheLogger {
  debug(bindings: Record<string, unknown>, msg?: string): void;
  info(bindings: Record<string, unknown>, msg?: string): void;
  warn(bindings: Record<string, unknown>, msg?: string): void;
  error(bindings: Record<string, unknown>, msg?: string): void;
}

export type CacheLogLevel = "debug" | "info" | "silent";

export interface CacheManagerConfig<
  T extends Record<string, ProviderConfig | undefined>,
> {
  default: keyof T & string;
  stores: T;
  /** Prepended to every key on every store (per-deploy namespacing). */
  keyPrefix?: string;
  /** Applied to writes without an explicit TTL, so entries always expire. */
  defaultTtlSeconds?: number;
  /** Defaults to `info`. `silent` suppresses internal `[cache]` lines. */
  logLevel?: CacheLogLevel;
}
