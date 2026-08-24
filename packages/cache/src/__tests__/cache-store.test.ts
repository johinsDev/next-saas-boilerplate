import { describe, expect, it, vi } from "vitest";

import { CacheStore } from "../cache-store";
import { MemoryProvider } from "../providers/memory";

function makeStore() {
  return new CacheStore("test", new MemoryProvider(), { logLevel: "silent" });
}

describe("CacheStore", () => {
  it("round-trips a JSON-serializable value", async () => {
    const store = makeStore();
    await store.set("user", { id: "u1", name: "Lucia" });
    expect(await store.get<{ id: string; name: string }>("user")).toEqual({
      id: "u1",
      name: "Lucia",
    });
  });

  it("returns null for missing keys", async () => {
    const store = makeStore();
    expect(await store.get("ghost")).toBeNull();
  });

  it("expires entries after TTL", async () => {
    vi.useFakeTimers();
    const store = makeStore();
    await store.set("ephemeral", "x", 1);
    expect(await store.get("ephemeral")).toBe("x");

    vi.advanceTimersByTime(2_000);
    expect(await store.get("ephemeral")).toBeNull();
    vi.useRealTimers();
  });

  it("getOrSet hits cache on second call (factory runs once)", async () => {
    const store = makeStore();
    const factory = vi.fn(async () => ({ computed: true }));

    const a = await store.getOrSet("k", factory, 60);
    const b = await store.getOrSet("k", factory, 60);

    expect(a).toEqual({ computed: true });
    expect(b).toEqual({ computed: true });
    expect(factory).toHaveBeenCalledOnce();
  });

  it("has / missing reflect the underlying provider", async () => {
    const store = makeStore();
    await store.set("present", 1);
    expect(await store.has("present")).toBe(true);
    expect(await store.missing("present")).toBe(false);
    expect(await store.has("absent")).toBe(false);
    expect(await store.missing("absent")).toBe(true);
  });

  it("deleteMany removes every key passed in", async () => {
    const store = makeStore();
    await store.set("a", 1);
    await store.set("b", 2);
    await store.set("c", 3);

    await store.deleteMany(["a", "c"]);

    expect(await store.has("a")).toBe(false);
    expect(await store.has("b")).toBe(true);
    expect(await store.has("c")).toBe(false);
  });

  it("flush clears the underlying provider", async () => {
    const store = makeStore();
    await store.set("a", 1);
    await store.set("b", 2);
    await store.flush();
    expect(await store.has("a")).toBe(false);
    expect(await store.has("b")).toBe(false);
  });

  it("uses the supplied logger for structured events", async () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const store = new CacheStore("test", new MemoryProvider(), {
      logger,
      logLevel: "debug",
    });
    await store.set("k", "v");
    const [bindings, msg] = logger.debug.mock.calls[0]!;
    expect(msg).toBe("cache.set");
    expect(bindings).toMatchObject({
      _service: "cache",
      key: "k",
      store: "test",
    });
  });
});
