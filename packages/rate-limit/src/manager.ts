import type { FakeLimiter } from "./fake-limiter";
import { MemoryProvider, RedisProvider, UpstashProvider } from "./providers";
import type {
  ProviderConfig,
  RateLimiterConfig,
  RateLimitLogger,
  RateLimitLogLevel,
  RateLimitProvider,
  RateLimitResult,
  RateLimitRule,
} from "./types";

function createProvider(config: ProviderConfig): RateLimitProvider {
  switch (config.provider) {
    case "memory":
      return new MemoryProvider();
    case "upstash":
      return new UpstashProvider(config);
    case "redis":
      return new RedisProvider(config);
  }
}

/**
 * Owns the named stores and routes `limit()` to the active one. Same
 * shape as `CacheManager` / `SmsManager` so the bootstrap + testing
 * patterns transfer.
 *
 * @example
 *   export const rateLimiter = new RateLimiter({
 *     default: env.RATE_LIMIT_PROVIDER ?? "memory",
 *     stores: {
 *       memory: { provider: "memory" },
 *       upstash: env.UPSTASH_REDIS_REST_URL ? { provider: "upstash" } : undefined,
 *       redis: env.REDIS_URL ? { provider: "redis", url: env.REDIS_URL } : undefined,
 *     },
 *     namespace: env.CACHE_KEY_PREFIX, // per-PR isolation, reused
 *     logger: log,
 *   });
 *
 *   const { success, resetAt } = await rateLimiter.limit(
 *     `otp:${phone}`,
 *     { limit: 5, window: "30m" },
 *   );
 */
export class RateLimiter<
  TStores extends Record<string, ProviderConfig | undefined>,
> {
  readonly #config: RateLimiterConfig<TStores>;
  readonly #logger?: RateLimitLogger;
  readonly #logLevel: RateLimitLogLevel;
  readonly #providers = new Map<string, RateLimitProvider>();
  #fake?: FakeLimiter;

  constructor(config: RateLimiterConfig<TStores> & { logger?: RateLimitLogger }) {
    const definedStores = Object.fromEntries(
      Object.entries(config.stores).filter(([, v]) => v !== undefined),
    ) as TStores;
    this.#config = {
      default: config.default,
      stores: definedStores,
      namespace: config.namespace,
      logLevel: config.logLevel,
    };
    this.#logger = config.logger;
    this.#logLevel = config.logLevel ?? "info";
  }

  #use(storeName?: keyof TStores & string): RateLimitProvider {
    const name = storeName ?? this.#config.default;
    if (!name) {
      throw new Error(
        "No store name provided and no default configured. Set `default` on RateLimiterConfig.",
      );
    }
    const storeConfig = this.#config.stores[name];
    if (!storeConfig) {
      throw new Error(
        `Unknown store "${name}". Configured: ${Object.keys(this.#config.stores).join(", ") || "<none>"}`,
      );
    }
    const cached = this.#providers.get(name);
    if (cached) return cached;
    const provider = createProvider(storeConfig);
    this.#providers.set(name, provider);
    return provider;
  }

  async limit(
    key: string,
    rule: RateLimitRule,
    opts?: { store?: keyof TStores & string },
  ): Promise<RateLimitResult> {
    const namespaced = `${this.#config.namespace ?? ""}${key}`;
    if (this.#fake) return this.#fake.limit(namespaced, rule);
    const provider = this.#use(opts?.store);
    const result = await provider.limit(namespaced, rule);
    if (this.#logLevel === "debug") {
      this.#logger?.debug(
        { key: namespaced, provider: provider.name, ...result },
        "rate-limit.check",
      );
    }
    return result;
  }

  /** Swap in a deterministic in-memory limiter for tests. */
  fake(limiter: FakeLimiter): FakeLimiter {
    this.#fake = limiter;
    return limiter;
  }

  restore(): void {
    this.#fake = undefined;
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(
      [...this.#providers.values()].map((p) => p.disconnect?.()),
    );
    this.#providers.clear();
  }
}
