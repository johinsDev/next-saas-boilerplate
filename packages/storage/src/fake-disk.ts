import { StorageDisk } from "./disk";
import { MemoryProvider } from "./providers/memory";
import type { StorageBody, StorageFile } from "./types";

const FAKE_BASE_URL = "http://fake.local";
const FAKE_SECRET = "fake-secret-not-used-in-tests-padding-padding-padding";

/**
 * In-memory disk for tests. Activated via `storageManager.fake()`.
 * Same `StorageDisk` surface plus fluent assertions and a `seed()`
 * helper for arrange-step data.
 *
 * @example
 *   const fake = storage.fake();
 *   await runFlowThatUploads();
 *   fake.assertExists("avatars/lucia.png");
 *   fake.assertCount(1, "avatars/");
 *   storage.restore();
 */
export class FakeDisk extends StorageDisk {
  readonly #memory: MemoryProvider;

  constructor() {
    const memory = new MemoryProvider({
      baseUrl: FAKE_BASE_URL,
      secret: FAKE_SECRET,
    });
    super({ name: "fake", provider: memory, isPublic: false, logLevel: "silent" });
    this.#memory = memory;
  }

  /** Arrange step: drop bytes into the fake without going through put(). */
  async seed(key: string, body: StorageBody): Promise<StorageFile> {
    return this.#memory.put(key, body);
  }

  clear(): void {
    this.#memory.clear();
  }

  /** All keys currently in the fake disk. */
  get keys(): string[] {
    return this.#memory.keys();
  }

  assertExists(key: string): this {
    if (!this.#memory.keys().includes(key)) {
      throw new Error(`Expected key "${key}" in fake disk; got: ${this.#memory.keys().join(", ") || "<empty>"}`);
    }
    return this;
  }

  assertNotExists(key: string): this {
    if (this.#memory.keys().includes(key)) {
      throw new Error(`Expected key "${key}" NOT in fake disk`);
    }
    return this;
  }

  assertCount(count: number, prefix?: string): this {
    const matching = prefix
      ? this.#memory.keys().filter((k) => k.startsWith(prefix))
      : this.#memory.keys();
    if (matching.length !== count) {
      throw new Error(
        `Expected ${count} files${prefix ? ` with prefix "${prefix}"` : ""} in fake disk, got ${matching.length}`,
      );
    }
    return this;
  }

  assertNonePut(): this {
    if (this.#memory.keys().length > 0) {
      throw new Error(
        `Expected no files in fake disk, got: ${this.#memory.keys().join(", ")}`,
      );
    }
    return this;
  }
}
