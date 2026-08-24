import { MissingDependencyError, ProviderError } from "../errors";
import {
  parseDuration,
  type RateLimitProvider,
  type RateLimitResult,
  type RateLimitRule,
  type RedisProviderConfig,
} from "../types";
import { dynamicImport } from "./_lazy";

/**
 * Traditional Redis limiter via `ioredis` — for long-lived processes
 * (jobs, self-hosted). Fixed-window: `INCR` the key, set the TTL on the
 * first hit of the window. Simpler (and slightly less precise at window
 * edges) than the sliding window the upstash provider uses; fine for
 * abuse protection. On Vercel prefer `upstash` (REST survives cold starts).
 */
export class RedisProvider implements RateLimitProvider {
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

  async limit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    try {
      const client = await this.#getClient();
      const redisKey = `@saas/rl:${key}`;
      const windowMs = parseDuration(rule.window) * 1000;
      const count = await client.incr(redisKey);
      if (count === 1) {
        await client.pexpire(redisKey, windowMs);
      }
      const pttl = await client.pttl(redisKey);
      const resetAt = Date.now() + (pttl > 0 ? pttl : windowMs);
      return {
        success: count <= rule.limit,
        limit: rule.limit,
        remaining: Math.max(0, rule.limit - count),
        resetAt,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(this.name, asMessage(error), error);
    }
  }

  async reset(key: string): Promise<void> {
    const client = await this.#getClient();
    await client.del(`@saas/rl:${key}`);
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
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
  del(key: string): Promise<unknown>;
  quit(): Promise<unknown>;
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
