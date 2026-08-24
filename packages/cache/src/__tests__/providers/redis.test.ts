import { describe, expect, it } from "vitest";

import { MissingDependencyError } from "../../errors";
import { RedisProvider } from "../../providers/redis";

/**
 * `ioredis` is an optional peer dep that isn't installed in this
 * monorepo by default. So the only thing we can deterministically
 * test without the package is the missing-dependency error path.
 *
 * Integration with a real redis is left to the host app — this UT
 * locks in the contract: pick `redis` without installing `ioredis`,
 * get a clear error instead of a confusing import failure.
 */
describe("RedisProvider", () => {
  it("throws MissingDependencyError when ioredis is not installed", async () => {
    const provider = new RedisProvider({
      provider: "redis",
      url: "redis://localhost:6379",
    });
    await expect(provider.get("k")).rejects.toBeInstanceOf(
      MissingDependencyError,
    );
  });
});
