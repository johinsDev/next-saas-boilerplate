import { CacheStore } from "./cache-store";
import { MemoryProvider } from "./providers/memory";

/**
 * In-memory store for tests. Activated via `cacheManager.fake()`.
 * All operations stay process-local; nothing reaches network providers.
 *
 * @example
 *   const fake = cache.fake();
 *   await fake.seed("user:123", { name: "Lucia" });
 *
 *   await runFlowThatReadsUserFromCache();
 *
 *   await fake.assertHas("user:123");
 *   await fake.assertHasValue("user:123", { name: "Lucia" });
 *   await fake.assertMissing("user:999");
 *
 *   cache.restore();
 */
export class FakeStore extends CacheStore {
  constructor() {
    super("fake", new MemoryProvider(), { logLevel: "silent" });
  }

  /** Pre-seed a value before the unit under test runs. */
  async seed(key: string, value: unknown): Promise<this> {
    await this.set(key, value);
    return this;
  }

  async assertHas(key: string): Promise<this> {
    if (!(await this.has(key))) {
      throw new Error(`Expected cache key "${key}" to exist`);
    }
    return this;
  }

  async assertMissing(key: string): Promise<this> {
    if (await this.has(key)) {
      throw new Error(`Expected cache key "${key}" to NOT exist`);
    }
    return this;
  }

  async assertHasValue<T>(key: string, expected: T): Promise<this> {
    const actual = await this.get<T>(key);
    if (actual === null) {
      throw new Error(`Expected cache key "${key}" to exist`);
    }
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `Expected cache key "${key}" to be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
    return this;
  }
}
