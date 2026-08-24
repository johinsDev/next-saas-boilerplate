import { MissingDependencyError, ProviderError } from "../errors";
import type { CacheProvider, RedisProviderConfig } from "../types";
import { dynamicImport } from "./_lazy";

/**
 * Traditional Redis provider via `ioredis`. Good for long-lived
 * server processes (jobs, self-hosted instances). For serverless
 * workloads on Vercel use the `upstash` provider instead — `ioredis`
 * keeps a persistent TCP connection that doesn't survive Vercel's
 * cold-starts well.
 *
 * Lazy-loads `ioredis` on first call. Requires the package to be
 * installed (`bun add ioredis`) when the provider is selected.
 */
export class RedisProvider implements CacheProvider {
  readonly name = "redis";
  readonly #config: RedisProviderConfig;
  #client: unknown;

  constructor(config: RedisProviderConfig) {
    this.#config = config;
  }

  async #getClient(): Promise<RedisClientLike> {
    if (this.#client) return this.#client as RedisClientLike;
    let mod: { default: new (url: string) => RedisClientLike };
    try {
      mod = (await dynamicImport("ioredis")) as unknown as typeof mod;
    } catch {
      throw new MissingDependencyError("redis", "ioredis");
    }
    this.#client = new mod.default(this.#config.url);
    return this.#client as RedisClientLike;
  }

  async get(key: string): Promise<string | null> {
    try {
      const client = await this.#getClient();
      return await client.get(key);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(this.name, asMessage(error), error);
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      const client = await this.#getClient();
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, value, "EX", ttlSeconds);
      } else {
        await client.set(key, value);
      }
    } catch (error) {
      throw new ProviderError(this.name, asMessage(error), error);
    }
  }

  async delete(key: string): Promise<void> {
    const client = await this.#getClient();
    await client.del(key);
  }

  async has(key: string): Promise<boolean> {
    const client = await this.#getClient();
    return (await client.exists(key)) === 1;
  }

  async flush(): Promise<void> {
    const client = await this.#getClient();
    await client.flushdb();
  }

  async disconnect(): Promise<void> {
    const client = this.#client as RedisClientLike | undefined;
    if (client) {
      await client.quit();
      this.#client = undefined;
    }
  }
}

interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(...args: unknown[]): Promise<unknown>;
  del(key: string): Promise<unknown>;
  exists(key: string): Promise<number>;
  flushdb(): Promise<unknown>;
  quit(): Promise<unknown>;
}

function asMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
