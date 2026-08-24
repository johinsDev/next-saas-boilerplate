import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PostHogFetchStrategy } from "../../providers/posthog-fetch";

function makeStrategy(host?: string) {
  return new PostHogFetchStrategy({ provider: "posthog", apiKey: "phc_test", host });
}

function decideResponse(featureFlags: Record<string, boolean | string>) {
  return new Response(JSON.stringify({ featureFlags }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("PostHogFetchStrategy (feature-flags)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(decideResponse({}));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs decide to /decide/?v=3 with api_key + distinct_id", async () => {
    const s = makeStrategy();
    await s.getAllFlags({ distinctId: "user:1" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://us.i.posthog.com/decide/?v=3");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      api_key: "phc_test",
      distinct_id: "user:1",
    });
  });

  it("isEnabled returns true when the flag is true", async () => {
    fetchMock.mockResolvedValue(decideResponse({ "new-checkout-flow": true }));
    const s = makeStrategy();
    expect(await s.isEnabled({ distinctId: "u", key: "new-checkout-flow" })).toBe(true);
  });

  it("isEnabled returns true when the flag is a string variant", async () => {
    fetchMock.mockResolvedValue(decideResponse({ "exp": "variant" }));
    const s = makeStrategy();
    expect(await s.isEnabled({ distinctId: "u", key: "exp" })).toBe(true);
  });

  it("isEnabled returns false when the flag is false", async () => {
    fetchMock.mockResolvedValue(decideResponse({ "kill-switch": false }));
    const s = makeStrategy();
    expect(await s.isEnabled({ distinctId: "u", key: "kill-switch" })).toBe(false);
  });

  it("isEnabled returns undefined when the flag is missing", async () => {
    fetchMock.mockResolvedValue(decideResponse({ other: true }));
    const s = makeStrategy();
    expect(await s.isEnabled({ distinctId: "u", key: "absent" })).toBeUndefined();
  });

  it("isEnabled returns undefined when fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const s = makeStrategy();
    expect(await s.isEnabled({ distinctId: "u", key: "any" })).toBeUndefined();
  });

  it("getValue returns the flag value (string or boolean)", async () => {
    // A Response body is single-read, so hand each call a fresh one.
    fetchMock.mockImplementation(() => decideResponse({ exp: "treatment", flag: true }));
    const s = makeStrategy();
    expect(await s.getValue({ distinctId: "u", key: "exp" })).toBe("treatment");
    expect(await s.getValue({ distinctId: "u", key: "flag" })).toBe(true);
    expect(await s.getValue({ distinctId: "u", key: "missing" })).toBeUndefined();
  });

  it("getAllFlags returns the featureFlags map", async () => {
    fetchMock.mockResolvedValue(decideResponse({ a: true, b: "treatment" }));
    const s = makeStrategy();
    expect(await s.getAllFlags({ distinctId: "u" })).toEqual({ a: true, b: "treatment" });
  });

  it("getAllFlags returns {} when fetch fails (soft-fail)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const s = makeStrategy();
    expect(await s.getAllFlags({ distinctId: "u" })).toEqual({});
  });

  it("getAllFlags returns {} on a non-ok response (soft-fail)", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    const s = makeStrategy();
    expect(await s.getAllFlags({ distinctId: "u" })).toEqual({});
    expect(await s.isEnabled({ distinctId: "u", key: "any" })).toBeUndefined();
  });

  it("strips a trailing slash from a custom host", async () => {
    const s = makeStrategy("https://eu.i.posthog.com/");
    await s.getAllFlags({ distinctId: "u" });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://eu.i.posthog.com/decide/?v=3");
  });

  it("shutdown resolves as a no-op", async () => {
    const s = makeStrategy();
    await expect(s.shutdown()).resolves.toBeUndefined();
  });
});
