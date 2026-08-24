import type { CacheProvider } from "../types";

interface Entry {
  value: string;
  expiresAt?: number;
}

/**
 * In-memory cache provider with TTL support. Expired entries are
 * cleaned up lazily on access (no background sweeper). Process-local
 * — does not survive a restart and does not cross instances.
 *
 * Use for tests + local dev. Use Upstash in serverless / preview /
 * production.
 */
export class MemoryProvider implements CacheProvider {
  readonly name = "memory";
  readonly #store = new Map<string, Entry>();

  async get(key: string): Promise<string | null> {
    const entry = this.#store.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.#store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.#store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async delete(key: string): Promise<void> {
    this.#store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async flush(): Promise<void> {
    this.#store.clear();
  }
}
