import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeRecord, resetFakeRecordCounter } from "../../factories";
import { BetterStackTransport, type FetchLike } from "../../transports/better-stack";

interface FakeFetchCall {
  url: string;
  init: { method: string; headers: Record<string, string>; body: string };
}

function fakeFetch(
  responder: (call: FakeFetchCall) => { ok: boolean; status: number; statusText?: string },
) {
  const calls: FakeFetchCall[] = [];
  const fn: FetchLike = vi.fn(async (url, init) => {
    calls.push({ url, init });
    const r = responder({ url, init });
    return { ok: r.ok, status: r.status, statusText: r.statusText ?? "" };
  });
  return { fn, calls };
}

describe("BetterStackTransport", () => {
  beforeEach(() => {
    resetFakeRecordCounter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes when batchSize is reached", async () => {
    const { fn: fetchMock, calls } = fakeFetch(() => ({ ok: true, status: 202 }));
    const t = new BetterStackTransport({
      sourceToken: "tok",
      batchSize: 2,
      fetch: fetchMock,
    });

    t.write(fakeRecord({ level: "info", msg: "a" }));
    expect(calls).toHaveLength(0);
    t.write(fakeRecord({ level: "info", msg: "b" }));
    await t.flush();

    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0]?.init.body ?? "[]") as Array<{ msg: string }>;
    expect(body.map((r) => r.msg)).toEqual(["a", "b"]);
    expect(calls[0]?.init.headers.Authorization).toBe("Bearer tok");
    expect(calls[0]?.url).toBe("https://in.logs.betterstack.com/");
  });

  it("flushes after the configured interval", async () => {
    const { fn: fetchMock, calls } = fakeFetch(() => ({ ok: true, status: 202 }));
    const t = new BetterStackTransport({
      sourceToken: "tok",
      batchSize: 50,
      flushIntervalMs: 1_000,
      fetch: fetchMock,
    });

    t.write(fakeRecord({ level: "info", msg: "x" }));
    expect(calls).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1_000);
    await t.flush();

    expect(calls).toHaveLength(1);
  });

  it("retries on 5xx with exponential backoff and gives up after maxRetries", async () => {
    const { fn: fetchMock, calls } = fakeFetch(() => ({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const t = new BetterStackTransport({
      sourceToken: "tok",
      batchSize: 1,
      maxRetries: 2,
      fetch: fetchMock,
    });

    t.write(fakeRecord({ level: "error", msg: "boom" }));
    await vi.runAllTimersAsync();
    await t.flush();

    // 1 initial + 2 retries = 3 attempts
    expect(calls).toHaveLength(3);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("succeeds after a transient failure", async () => {
    let attempt = 0;
    const { fn: fetchMock, calls } = fakeFetch(() => {
      attempt += 1;
      if (attempt === 1) return { ok: false, status: 502, statusText: "Bad Gateway" };
      return { ok: true, status: 202 };
    });
    const t = new BetterStackTransport({
      sourceToken: "tok",
      batchSize: 1,
      maxRetries: 3,
      fetch: fetchMock,
    });

    t.write(fakeRecord({ level: "info", msg: "eventually-ok" }));
    await vi.runAllTimersAsync();
    await t.flush();

    expect(calls).toHaveLength(2);
  });

  it("serializes Error fields for the payload", async () => {
    const { fn: fetchMock, calls } = fakeFetch(() => ({ ok: true, status: 202 }));
    const t = new BetterStackTransport({
      sourceToken: "tok",
      batchSize: 1,
      fetch: fetchMock,
    });

    const err = new Error("kaboom");
    t.write(
      fakeRecord({
        level: "error",
        msg: "fail",
        bindings: { userId: "u1" },
        err,
      }),
    );
    await t.flush();

    const body = JSON.parse(calls[0]?.init.body ?? "[]") as Array<{
      level: string;
      msg: string;
      userId: string;
      err: { name: string; message: string; stack?: string };
    }>;
    expect(body[0]).toMatchObject({
      level: "error",
      msg: "fail",
      userId: "u1",
      err: { name: "Error", message: "kaboom" },
    });
    expect(typeof body[0]?.err.stack).toBe("string");
  });

  it("flush() resolves only after pending POST completes", async () => {
    let resolvePost!: () => void;
    const fetchMock: FetchLike = vi.fn(
      () =>
        new Promise<{ ok: boolean; status: number; statusText: string }>((resolve) => {
          resolvePost = () => resolve({ ok: true, status: 202, statusText: "" });
        }),
    );
    const t = new BetterStackTransport({
      sourceToken: "tok",
      batchSize: 1,
      fetch: fetchMock,
    });

    t.write(fakeRecord({ level: "info", msg: "slow" }));

    let flushed = false;
    const flushPromise = t.flush().then(() => {
      flushed = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(flushed).toBe(false);

    resolvePost();
    await flushPromise;
    expect(flushed).toBe(true);
  });

  it("uses a custom host when provided", async () => {
    const { fn: fetchMock, calls } = fakeFetch(() => ({ ok: true, status: 202 }));
    const t = new BetterStackTransport({
      sourceToken: "tok",
      host: "in.logs.eu.betterstack.com",
      batchSize: 1,
      fetch: fetchMock,
    });

    t.write(fakeRecord({ level: "info", msg: "eu" }));
    await t.flush();

    expect(calls[0]?.url).toBe("https://in.logs.eu.betterstack.com/");
  });
});
