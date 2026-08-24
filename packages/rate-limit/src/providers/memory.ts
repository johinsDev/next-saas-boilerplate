import {
  parseDuration,
  type RateLimitProvider,
  type RateLimitResult,
  type RateLimitRule,
} from "../types";

interface Window {
  count: number;
  /** Epoch ms when this fixed window expires. */
  resetAt: number;
}

/**
 * In-process fixed-window counter. Zero deps, no network — the
 * **default for local dev**. NOT suitable for serverless/multi-instance
 * production: each instance keeps its own Map, so the effective limit
 * multiplies by the instance count. Use `upstash` there.
 */
export class MemoryProvider implements RateLimitProvider {
  readonly name = "memory";
  readonly #windows = new Map<string, Window>();

  async limit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const now = Date.now();
    let window = this.#windows.get(key);
    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + parseDuration(rule.window) * 1000 };
      this.#windows.set(key, window);
    }
    window.count += 1;
    return {
      success: window.count <= rule.limit,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - window.count),
      resetAt: window.resetAt,
    };
  }

  async reset(key: string): Promise<void> {
    this.#windows.delete(key);
  }
}
