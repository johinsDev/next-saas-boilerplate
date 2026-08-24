import { describe, expect, it } from "vitest";

import { FakeStore } from "../fake-store";
import { CacheManager } from "../manager";

function makeManager() {
  return new CacheManager({
    default: "memory",
    stores: { memory: { provider: "memory" } },
    logLevel: "silent",
  });
}

describe("CacheManager", () => {
  it("uses the default store when none specified", async () => {
    const cache = makeManager();
    await cache.set("k", { hello: "world" }, 60);
    expect(await cache.get<{ hello: string }>("k")).toEqual({ hello: "world" });
  });

  it("caches the store instance per name", () => {
    const cache = makeManager();
    expect(cache.use("memory")).toBe(cache.use("memory"));
  });

  it("throws on unknown store", () => {
    const cache = makeManager();
    expect(() =>
      // @ts-expect-error testing runtime guard
      cache.use("nope"),
    ).toThrow(/Unknown store/);
  });

  it("strips undefined stores (conditional config)", () => {
    const cache = new CacheManager({
      default: "memory",
      stores: {
        memory: { provider: "memory" },
        upstash: undefined,
      },
      logLevel: "silent",
    });
    expect(() => cache.use("upstash" as "memory")).toThrow(/Unknown store/);
  });

  it("fake() swaps the store; restore() reverts", async () => {
    const cache = makeManager();
    const fake = cache.fake();
    expect(fake).toBeInstanceOf(FakeStore);

    await cache.set("k", "via-fake");
    expect(await fake.get("k")).toBe("via-fake");

    cache.restore();
    // Real store is empty (the value lived only in the fake).
    expect(await cache.get("k")).toBeNull();
  });

  it("shorthand methods route to the default store", async () => {
    const cache = makeManager();
    const factory = async () => 42;
    const a = await cache.getOrSet("answer", factory, 60);
    const b = await cache.getOrSet("answer", factory, 60);
    expect(a).toBe(42);
    expect(b).toBe(42);
    expect(await cache.has("answer")).toBe(true);
    await cache.delete("answer");
    expect(await cache.missing("answer")).toBe(true);
  });
});
