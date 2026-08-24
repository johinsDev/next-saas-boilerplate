import type { CacheLogLevel, CacheLogger, CacheProvider } from "./types";

export interface CacheStoreOptions {
  logger?: CacheLogger;
  logLevel?: CacheLogLevel;
  /**
   * Prepended to every key (callers keep using logical keys). Use it to
   * namespace a deploy — e.g. `pr-123:` in preview so each PR's entries are
   * isolated and can be flushed by prefix on PR close. Empty (default) = no-op.
   */
  keyPrefix?: string;
  /**
   * Applied when a `set`/`getOrSet` call doesn't pass its own TTL. Guarantees
   * every entry expires so a shared cache (e.g. one Upstash across all
   * previews) can't grow unbounded. Undefined = entries are permanent unless
   * the caller passes a TTL.
   */
  defaultTtlSeconds?: number;
}

/**
 * Wraps a single `CacheProvider` and adds:
 *
 *   - JSON serialization on read + write (so callers can `get<T>()`
 *     and receive typed objects without juggling `JSON.parse` themselves).
 *   - The `getOrSet(key, factory, ttl)` convenience for the most common
 *     read-through pattern.
 *   - An optional `keyPrefix` (per-deploy namespacing) + `defaultTtlSeconds`
 *     (so entries always expire).
 *   - Structured logging via `@saas/log` (or any logger that
 *     satisfies the `CacheLogger` structural type).
 *
 * One store per named entry in the manager; the manager caches
 * instances.
 */
export class CacheStore {
  readonly name: string;
  readonly #provider: CacheProvider;
  readonly #logger?: CacheLogger;
  readonly #logLevel: CacheLogLevel;
  readonly #keyPrefix: string;
  readonly #defaultTtlSeconds?: number;

  constructor(
    name: string,
    provider: CacheProvider,
    options: CacheStoreOptions = {},
  ) {
    this.name = name;
    this.#provider = provider;
    this.#logger = options.logger;
    this.#logLevel = options.logLevel ?? "info";
    this.#keyPrefix = options.keyPrefix ?? "";
    this.#defaultTtlSeconds = options.defaultTtlSeconds;
  }

  /** logical key → physical (namespaced) key sent to the provider. */
  #key(key: string): string {
    return this.#keyPrefix + key;
  }

  /** Read by key. Returns `null` on miss. Auto-deserializes JSON. */
  async get<T = unknown>(key: string): Promise<T | null> {
    this.#log("debug", { key, store: this.name }, "cache.get");
    const raw = await this.#provider.get(this.#key(key));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Non-JSON raw strings (older code paths) — surface as-is.
      return raw as T;
    }
  }

  /**
   * Write with optional TTL (seconds). Falls back to the store's
   * `defaultTtlSeconds` when none is given. Auto-serializes via
   * `JSON.stringify`.
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.#defaultTtlSeconds;
    this.#log("debug", { key, store: this.name, ttl }, "cache.set");
    const serialized = JSON.stringify(value);
    await this.#provider.set(this.#key(key), serialized, ttl);
  }

  /**
   * Read-through: return the cached value, or run `factory()` and
   * cache the result. The factory only fires on a miss.
   *
   * @example
   *   const customer = await cache.getOrSet(
   *     `customer:${id}`,
   *     () => db.query.customers.findFirst({ where: eq(customers.id, id) }),
   *     300, // 5 min
   *   );
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      this.#log("debug", { key, store: this.name }, "cache.hit");
      return cached;
    }
    this.#log("debug", { key, store: this.name }, "cache.miss");
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async has(key: string): Promise<boolean> {
    return this.#provider.has(this.#key(key));
  }

  async missing(key: string): Promise<boolean> {
    return !(await this.has(key));
  }

  async delete(key: string): Promise<void> {
    this.#log("debug", { key, store: this.name }, "cache.delete");
    await this.#provider.delete(this.#key(key));
  }

  async deleteMany(keys: string[]): Promise<void> {
    this.#log(
      "debug",
      { keys, count: keys.length, store: this.name },
      "cache.deleteMany",
    );
    await Promise.all(keys.map((key) => this.#provider.delete(this.#key(key))));
  }

  async flush(): Promise<void> {
    this.#log("info", { store: this.name }, "cache.flush");
    await this.#provider.flush();
  }

  async disconnect(): Promise<void> {
    await this.#provider.disconnect?.();
  }

  #log(
    level: "debug" | "info",
    bindings: Record<string, unknown>,
    msg: string,
  ): void {
    if (this.#logLevel === "silent") return;
    if (level === "debug" && this.#logLevel !== "debug") return;
    if (this.#logger) {
      const fn = level === "debug" ? this.#logger.debug : this.#logger.info;
      fn.call(this.#logger, { ...bindings, _service: "cache" }, msg);
      return;
    }
    console.log("[cache]", msg, bindings);
  }
}
