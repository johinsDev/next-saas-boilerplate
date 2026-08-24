import { MemoryProvider } from "./providers/memory";
import type { RateLimitProvider, RateLimitResult, RateLimitRule } from "./types";

/**
 * Test double. Counts for real (wraps `MemoryProvider`) so window
 * behaviour is exercised, records every call for assertions, and lets
 * a test force specific keys to be blocked.
 *
 * @example
 *   const fake = new FakeLimiter().block("ip:1.2.3.4");
 *   rateLimiter.fake(fake);
 *   // ...exercise the unit...
 *   fake.assertChecked("ip:1.2.3.4");
 */
export class FakeLimiter implements RateLimitProvider {
  readonly name = "fake";
  readonly calls: Array<{ key: string; rule: RateLimitRule }> = [];
  readonly #memory = new MemoryProvider();
  readonly #blocked = new Set<string>();

  async limit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    this.calls.push({ key, rule });
    if (this.#blocked.has(key)) {
      return { success: false, limit: rule.limit, remaining: 0, resetAt: Date.now() };
    }
    return this.#memory.limit(key, rule);
  }

  /** Force this key to always be blocked, regardless of count. */
  block(key: string): this {
    this.#blocked.add(key);
    return this;
  }

  assertChecked(key: string): this {
    if (!this.calls.some((c) => c.key === key)) {
      throw new Error(`Expected rate limit to have been checked for "${key}"`);
    }
    return this;
  }

  /** Wipe recorded calls + forced blocks between test cases. */
  clear(): void {
    this.calls.length = 0;
    this.#blocked.clear();
  }
}
