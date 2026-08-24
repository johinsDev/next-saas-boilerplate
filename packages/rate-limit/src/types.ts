/**
 * A window length: a number of seconds, or a short duration string
 * like `"10s"`, `"1m"`, `"1h"`, `"1d"`. Mirrors how the limits read in
 * prose ("10 per minute" → `{ limit: 10, window: "1m" }`).
 */
export type Duration = `${number}${"s" | "m" | "h" | "d"}`;

const UNIT_SECONDS: Record<"s" | "m" | "h" | "d", number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

/** Normalise a `Duration` (or a raw seconds number) to seconds. */
export function parseDuration(window: Duration | number): number {
  if (typeof window === "number") {
    if (!Number.isFinite(window) || window <= 0) {
      throw new Error(`Invalid window seconds: ${window}`);
    }
    return window;
  }
  const match = /^(\d+)(s|m|h|d)$/.exec(window);
  if (!match) {
    throw new Error(
      `Invalid duration "${window}" — use e.g. "10s", "1m", "1h", "1d".`,
    );
  }
  const unit = match[2] as "s" | "m" | "h" | "d";
  return Number(match[1]) * UNIT_SECONDS[unit];
}

export interface RateLimitRule {
  /** Max requests allowed within `window`. */
  limit: number;
  /** Window length (`"1m"`, `"10s"`, …) or a raw number of seconds. */
  window: Duration | number;
}

export interface RateLimitResult {
  /** False when the request is over the limit (caller should reject). */
  success: boolean;
  limit: number;
  /** Requests left in the current window (0 when blocked). */
  remaining: number;
  /** Epoch ms when the window resets / the next request is allowed. */
  resetAt: number;
}

/**
 * Low-level driver every provider implements. The `RateLimiter`
 * manager above adds the `namespace` prefix + structured logging.
 */
export interface RateLimitProvider {
  readonly name: string;
  limit(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
  /** Clear a key's window (mostly for tests + admin tooling). */
  reset?(key: string): Promise<void>;
  /** Only network-backed providers need to clean up. */
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

export interface RateLimitLogger {
  debug(bindings: Record<string, unknown>, msg?: string): void;
  info(bindings: Record<string, unknown>, msg?: string): void;
  warn(bindings: Record<string, unknown>, msg?: string): void;
  error(bindings: Record<string, unknown>, msg?: string): void;
}

export type RateLimitLogLevel = "debug" | "info" | "silent";

export interface RateLimiterConfig<
  T extends Record<string, ProviderConfig | undefined>,
> {
  default: keyof T & string;
  stores: T;
  /** Prepended to every key (per-deploy / per-PR namespacing). */
  namespace?: string;
  /** Defaults to `info`. `silent` suppresses internal `[rate-limit]` lines. */
  logLevel?: RateLimitLogLevel;
}
