import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { ProviderError } from "../errors";
import {
  parseDuration,
  type RateLimitProvider,
  type RateLimitResult,
  type RateLimitRule,
  type UpstashProviderConfig,
} from "../types";

/**
 * Upstash rate limiter — built on `@upstash/ratelimit` + `@upstash/redis`
 * (REST, serverless-friendly, atomic sliding window). **Default for preview +
 * production.** Both SDKs are fetch-based and statically imported, so this runs
 * on Node AND Cloudflare Workers (workerd) — NOT lazy-loaded: a `dynamicImport`
 * here is `new Function`, which workerd forbids (it would crash the API Worker
 * on the first rate-limited request).
 *
 * `@upstash/ratelimit` binds the limit + window at construction, so we keep one
 * `Ratelimit` instance per distinct `(limit, window)` rule.
 */
export class UpstashProvider implements RateLimitProvider {
  readonly name = "upstash";
  readonly #redis: Redis;
  readonly #limiters = new Map<string, Ratelimit>();

  constructor(config: UpstashProviderConfig) {
    this.#redis =
      config.url && config.token
        ? new Redis({ url: config.url, token: config.token })
        : Redis.fromEnv();
  }

  #getLimiter(rule: RateLimitRule): Ratelimit {
    const windowSeconds = parseDuration(rule.window);
    const cacheKey = `${rule.limit}:${windowSeconds}`;
    const existing = this.#limiters.get(cacheKey);
    if (existing) return existing;

    const limiter = new Ratelimit({
      redis: this.#redis,
      // `${n} s` is the duration format @upstash/ratelimit expects.
      limiter: Ratelimit.slidingWindow(rule.limit, `${windowSeconds} s`),
      prefix: "@saas/rl",
      analytics: false,
    });
    this.#limiters.set(cacheKey, limiter);
    return limiter;
  }

  async limit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    try {
      const limiter = this.#getLimiter(rule);
      const res = await limiter.limit(key);
      return {
        success: res.success,
        limit: res.limit,
        remaining: res.remaining,
        resetAt: res.reset,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(this.name, asMessage(error), error);
    }
  }
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
