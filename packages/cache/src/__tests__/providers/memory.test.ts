import { describe, expect, it, vi } from "vitest";

import { MemoryProvider } from "../../providers/memory";

describe("MemoryProvider", () => {
  it("set/get round-trip", async () => {
    const p = new MemoryProvider();
    await p.set("k", "v");
    expect(await p.get("k")).toBe("v");
  });

  it("delete removes the key", async () => {
    const p = new MemoryProvider();
    await p.set("k", "v");
    await p.delete("k");
    expect(await p.get("k")).toBeNull();
  });

  it("has reflects presence", async () => {
    const p = new MemoryProvider();
    expect(await p.has("k")).toBe(false);
    await p.set("k", "v");
    expect(await p.has("k")).toBe(true);
  });

  it("TTL expires entries lazily", async () => {
    vi.useFakeTimers();
    const p = new MemoryProvider();
    await p.set("k", "v", 1);
    expect(await p.get("k")).toBe("v");
    vi.advanceTimersByTime(1_500);
    expect(await p.get("k")).toBeNull();
    vi.useRealTimers();
  });

  it("flush empties the store", async () => {
    const p = new MemoryProvider();
    await p.set("a", "1");
    await p.set("b", "2");
    await p.flush();
    expect(await p.get("a")).toBeNull();
    expect(await p.get("b")).toBeNull();
  });
});
