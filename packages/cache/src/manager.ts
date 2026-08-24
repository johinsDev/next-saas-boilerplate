import { CacheStore } from "./cache-store";
import { FakeStore } from "./fake-store";
import { MemoryProvider } from "./providers/memory";
import { RedisProvider } from "./providers/redis";
import { UpstashProvider } from "./providers/upstash";
import type {
  CacheLogLevel,
  CacheLogger,
  CacheManagerConfig,
  CacheProvider,
  ProviderConfig,
} from "./types";

function createProvider(config: ProviderConfig): CacheProvider {
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
 * Owns the named stores and routes calls to the active one. Same
 * shape as `SmsManager` / `WhatsAppManager` so the testing + bootstrap
 * patterns transfer between channels.
 *
 * Shorthand methods (`get`, `set`, `getOrSet`, …) delegate to
 * `use()` with no name (i.e. the default store).
 *
 * @example
 *   export const cache = new CacheManager({
 *     default: env.CACHE_PROVIDER ?? "memory",
 *     stores: {
 *       memory: { provider: "memory" },
 *       upstash: env.UPSTASH_REDIS_REST_URL ? { provider: "upstash" } : undefined,
 *       redis: env.REDIS_URL ? { provider: "redis", url: env.REDIS_URL } : undefined,
 *     },
 *     logger,
 *   });
 *
 *   const customer = await cache.getOrSet(
 *     `customer:${id}`,
 *     () => repo.findById(id),
 *     300,
 *   );
 */
export class CacheManager<
  TStores extends Record<string, ProviderConfig | undefined>,
> {
  readonly #config: CacheManagerConfig<TStores>;
  readonly #logger?: CacheLogger;
  readonly #logLevel: CacheLogLevel;
  readonly #storesCache = new Map<string, CacheStore>();
  #fakeStore?: FakeStore;

  constructor(
    config: CacheManagerConfig<TStores> & { logger?: CacheLogger },
  ) {
    const definedStores = Object.fromEntries(
      Object.entries(config.stores).filter(([, v]) => v !== undefined),
    ) as TStores;
    this.#config = {
      default: config.default,
      stores: definedStores,
      keyPrefix: config.keyPrefix,
      defaultTtlSeconds: config.defaultTtlSeconds,
      logLevel: config.logLevel,
    };
    this.#logger = config.logger;
    this.#logLevel = config.logLevel ?? "info";
  }

  use<K extends keyof TStores & string>(storeName?: K): CacheStore {
    const name = storeName ?? this.#config.default;
    if (!name) {
      throw new Error(
        "No store name provided and no default configured. Set `default` on CacheManagerConfig.",
      );
    }
    const storeConfig = this.#config.stores[name];
    if (!storeConfig) {
      throw new Error(
        `Unknown store "${name}". Configured: ${Object.keys(this.#config.stores).join(", ") || "<none>"}`,
      );
    }

    if (this.#fakeStore) return this.#fakeStore;

    const cached = this.#storesCache.get(name);
    if (cached) return cached;

    const provider = createProvider(storeConfig);
    const store = new CacheStore(name, provider, {
      logger: this.#logger,
      logLevel: this.#logLevel,
      keyPrefix: this.#config.keyPrefix,
      defaultTtlSeconds: this.#config.defaultTtlSeconds,
    });
    this.#storesCache.set(name, store);
    return store;
  }

  /** Activate the fake store. Subsequent `use()` returns the fake. */
  fake(): FakeStore {
    this.restore();
    this.#fakeStore = new FakeStore();
    return this.#fakeStore;
  }

  /** Disable fake mode (cleans up after tests). */
  restore(): void {
    this.#fakeStore = undefined;
  }

  /** Disconnect all live (non-fake) stores. */
  async disconnectAll(): Promise<void> {
    await Promise.all(
      [...this.#storesCache.values()].map((store) => store.disconnect()),
    );
    this.#storesCache.clear();
  }

  // ── Shorthand methods (delegate to default store) ────────────

  get<T = unknown>(key: string): Promise<T | null> {
    return this.use().get<T>(key);
  }

  set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    return this.use().set(key, value, ttlSeconds);
  }

  getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    return this.use().getOrSet<T>(key, factory, ttlSeconds);
  }

  has(key: string): Promise<boolean> {
    return this.use().has(key);
  }

  missing(key: string): Promise<boolean> {
    return this.use().missing(key);
  }

  delete(key: string): Promise<void> {
    return this.use().delete(key);
  }

  deleteMany(keys: string[]): Promise<void> {
    return this.use().deleteMany(keys);
  }

  flush(): Promise<void> {
    return this.use().flush();
  }
}
