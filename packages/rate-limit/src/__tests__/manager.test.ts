import { describe, expect, it, vi } from "vitest";

import { FakeLimiter } from "../fake-limiter";
import { RateLimiter } from "../manager";
import { parseDuration } from "../types";

function makeLimiter() {
  return new RateLimiter({
    default: "memory",
    stores: { memory: { provider: "memory" } },
    logLevel: "silent",
  });
}

describe("parseDuration", () => {
  it("parses duration strings to seconds", () => {
    expect(parseDuration("10s")).toBe(10);
    expect(parseDuration("1m")).toBe(60);
    expect(parseDuration("2h")).toBe(7200);
    expect(parseDuration("1d")).toBe(86400);
  });

  it("passes through positive numbers", () => {
    expect(parseDuration(45)).toBe(45);
  });

  it("rejects garbage", () => {
    expect(() => parseDuration("soon" as never)).toThrow();
    expect(() => parseDuration(0)).toThrow();
  });
});

describe("RateLimiter (memory)", () => {
  it("allows up to the limit, then blocks within the window", async () => {
    const rl = makeLimiter();
    const rule = { limit: 3, window: "1m" as const };

    const a = await rl.limit("user:1", rule);
    await rl.limit("user:1", rule);
    const c = await rl.limit("user:1", rule);
    const d = await rl.limit("user:1", rule);

    expect(a.success).toBe(true);
    expect(a.remaining).toBe(2);
    expect(c.success).toBe(true);
    expect(c.remaining).toBe(0);
    expect(d.success).toBe(false);
    expect(d.remaining).toBe(0);
  });

  it("keeps separate counters per key", async () => {
    const rl = makeLimiter();
    const rule = { limit: 1, window: "1m" as const };
    expect((await rl.limit("ip:a", rule)).success).toBe(true);
    expect((await rl.limit("ip:b", rule)).success).toBe(true);
    expect((await rl.limit("ip:a", rule)).success).toBe(false);
  });

  it("resets after the window elapses", async () => {
    const rl = makeLimiter();
    const rule = { limit: 1, window: 1 }; // 1 second
    expect((await rl.limit("k", rule)).success).toBe(true);
    expect((await rl.limit("k", rule)).success).toBe(false);
    // travel past the window
    const now = Date.now();
    vi.setSystemTime(now + 1100);
    expect((await rl.limit("k", rule)).success).toBe(true);
    vi.useRealTimers();
  });

  it("applies the namespace prefix", async () => {
    const rl = new RateLimiter({
      default: "memory",
      stores: { memory: { provider: "memory" } },
      namespace: "pr-7:",
      logLevel: "silent",
    });
    const fake = rl.fake(new FakeLimiter());
    await rl.limit("user:1", { limit: 5, window: "1m" });
    fake.assertChecked("pr-7:user:1");
  });

  it("routes through a fake limiter and records calls", async () => {
    const rl = makeLimiter();
    const fake = rl.fake(new FakeLimiter().block("user:blocked"));
    const ok = await rl.limit("user:ok", { limit: 5, window: "1m" });
    const blocked = await rl.limit("user:blocked", { limit: 5, window: "1m" });
    expect(ok.success).toBe(true);
    expect(blocked.success).toBe(false);
    fake.assertChecked("user:ok").assertChecked("user:blocked");
    rl.restore();
  });
});
