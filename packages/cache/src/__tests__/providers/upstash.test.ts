import { beforeEach, describe, expect, it, vi } from "vitest";

import { UpstashProvider } from "../../providers/upstash";

/**
 * `@upstash/redis` is REST/fetch-based and Workers-safe, so the provider
 * static-imports it (mirroring @saas/rate-limit). The SDK is mocked here so
 * the UT stays offline and asserts the provider delegates to the client and
 * normalizes values, without hitting a real Upstash instance.
 *
 * Integration with a real Upstash instance is verified manually against a
 * preview deploy (`UPSTASH_REDIS_REST_URL` set).
 */
const redisMock = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  flushdb: vi.fn(),
};

vi.mock("@upstash/redis", () => ({
  Redis: class {
    get = redisMock.get;
    set = redisMock.set;
    del = redisMock.del;
    exists = redisMock.exists;
    flushdb = redisMock.flushdb;
    static fromEnv() {
      return new this();
    }
  },
}));

describe("UpstashProvider", () => {
  beforeEach(() => {
    for (const fn of Object.values(redisMock)) fn.mockReset();
  });

  it('has a stable `name` of "upstash"', () => {
    const provider = new UpstashProvider({ provider: "upstash" });
    expect(provider.name).toBe("upstash");
  });

  it("accepts explicit url + token in config (no env read)", () => {
    const provider = new UpstashProvider({
      provider: "upstash",
      url: "https://example.upstash.io",
      token: "secret",
    });
    expect(provider).toBeInstanceOf(UpstashProvider);
  });

  it("delegates get() to the client and normalizes non-string values", async () => {
    redisMock.get.mockResolvedValueOnce({ a: 1 });
    const provider = new UpstashProvider({
      provider: "upstash",
      url: "https://example.upstash.io",
      token: "secret",
    });
    await expect(provider.get("k")).resolves.toBe(JSON.stringify({ a: 1 }));
    expect(redisMock.get).toHaveBeenCalledWith("k");
  });

  it("passes ttl through set() as `ex`", async () => {
    const provider = new UpstashProvider({
      provider: "upstash",
      url: "https://example.upstash.io",
      token: "secret",
    });
    await provider.set("k", "v", 60);
    expect(redisMock.set).toHaveBeenCalledWith("k", "v", { ex: 60 });
  });
});
