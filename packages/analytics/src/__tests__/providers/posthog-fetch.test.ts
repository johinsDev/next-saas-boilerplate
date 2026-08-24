import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PostHogFetchStrategy } from "../../providers/posthog-fetch";

function makeStrategy(host?: string) {
  return new PostHogFetchStrategy({ provider: "posthog", apiKey: "phc_test", host });
}

function okResponse(body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Await any pending fire-and-forget fetch microtasks. */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("PostHogFetchStrategy (analytics)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("capture POSTs to /capture/ with api_key, event, distinct_id, properties", async () => {
    const s = makeStrategy();
    s.capture({
      distinctId: "user:1",
      event: "subscription.started",
      properties: { cardId: "c_1" },
    });
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://us.i.posthog.com/capture/");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      api_key: "phc_test",
      event: "subscription.started",
      distinct_id: "user:1",
      properties: { cardId: "c_1" },
    });
    expect(typeof body.timestamp).toBe("string");
  });

  it("identify POSTs $identify with $set properties", async () => {
    const s = makeStrategy();
    s.identify({ distinctId: "user:7", properties: { email: "a@b.c" } });
    await flushMicrotasks();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://us.i.posthog.com/capture/");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      api_key: "phc_test",
      event: "$identify",
      distinct_id: "user:7",
      properties: { $set: { email: "a@b.c" } },
    });
  });

  it("strips a trailing slash from a custom host", async () => {
    const s = makeStrategy("https://eu.i.posthog.com/");
    s.capture({ distinctId: "u", event: "subscription.started", properties: {} });
    await flushMicrotasks();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://eu.i.posthog.com/capture/");
  });

  it("a rejected fetch does NOT throw out of capture (best-effort)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const s = makeStrategy();
    expect(() => s.capture({ distinctId: "u", event: "subscription.started", properties: {} })).not.toThrow();
    await flushMicrotasks();
  });

  it("a rejected fetch does NOT throw out of identify (best-effort)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const s = makeStrategy();
    expect(() => s.identify({ distinctId: "u", properties: {} })).not.toThrow();
    await flushMicrotasks();
  });

  it("flush and shutdown resolve as no-ops", async () => {
    const s = makeStrategy();
    await expect(s.flush()).resolves.toBeUndefined();
    await expect(s.shutdown()).resolves.toBeUndefined();
  });
});
