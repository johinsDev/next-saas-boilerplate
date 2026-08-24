import { Redis } from "@upstash/redis";

import { ProviderError } from "../errors";
import type { CacheProvider, UpstashProviderConfig } from "../types";

/**
 * Upstash Redis provider. Serverless-friendly (REST-based, no
 * persistent connection so it survives Vercel's request-per-instance
 * model). This is the **default for preview + production** in the
 * next-saas-boilerplate monorepo.
 *
 * Uses `Redis.fromEnv()` by default (reads `UPSTASH_REDIS_REST_URL`
 * and `UPSTASH_REDIS_REST_TOKEN`), or accepts explicit url/token via
 * config. Lazy-loads `@upstash/redis` on first call so apps that
 * don't pick this provider don't carry the dep at module load.
 */
export class UpstashProvider implements CacheProvider {
  readonly name = "upstash";
  readonly #config: UpstashProviderConfig;
  #client: unknown;

  constructor(config: UpstashProviderConfig) {
    this.#config = config;
  }

  async #getClient(): Promise<UpstashClientLike> {
    if (this.#client) return this.#client as UpstashClientLike;
    // Static import (mirrors @saas/rate-limit's upstash provider): `@upstash/redis`
    // is REST/fetch-based and Workers-safe, so the bundler must include it. The old
    // `new Function` dynamic import was forbidden by workerd (no code-gen) and hid the
    // specifier from esbuild, so it never landed in the API Worker bundle.
    this.#client =
      this.#config.url && this.#config.token
        ? new Redis({ url: this.#config.url, token: this.#config.token })
        : Redis.fromEnv();
    return this.#client as UpstashClientLike;
  }

  async get(key: string): Promise<string | null> {
    try {
      const client = await this.#getClient();
      const v = await client.get(key);
      // Upstash auto-parses JSON when it can; normalize back to string|null
      // so the CacheStore layer can re-parse uniformly. `null` stays `null`.
      if (v === null || v === undefined) return null;
      return typeof v === "string" ? v : JSON.stringify(v);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(this.name, asMessage(error), error);
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      const client = await this.#getClient();
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, value, { ex: ttlSeconds });
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
}

/** Narrow structural type — keeps `@upstash/redis` out of the build dep graph. */
interface UpstashClientLike {
  get(key: string): Promise<unknown>;
  set(
    key: string,
    value: string,
    opts?: { ex?: number },
  ): Promise<unknown>;
  del(key: string): Promise<unknown>;
  exists(key: string): Promise<number>;
  flushdb(): Promise<unknown>;
}

function asMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
