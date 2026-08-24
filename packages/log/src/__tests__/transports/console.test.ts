import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeRecord, resetFakeRecordCounter } from "../../factories";
import { ConsoleTransport } from "../../transports/console";

describe("ConsoleTransport", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetFakeRecordCounter();
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("routes records to the matching console method", () => {
    const t = new ConsoleTransport({ channel: "console", pretty: false });

    t.write(fakeRecord({ level: "trace", msg: "t" }));
    t.write(fakeRecord({ level: "debug", msg: "d" }));
    t.write(fakeRecord({ level: "info", msg: "i" }));
    t.write(fakeRecord({ level: "warn", msg: "w" }));
    t.write(fakeRecord({ level: "error", msg: "e" }));
    t.write(fakeRecord({ level: "fatal", msg: "f" }));

    expect(logSpy).toHaveBeenCalledTimes(2); // trace + debug
    expect(infoSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledTimes(2); // error + fatal
  });

  it("emits compact JSON when pretty=false", () => {
    const t = new ConsoleTransport({ channel: "console", pretty: false });

    t.write(
      fakeRecord({
        level: "info",
        msg: "with bindings",
        bindings: { userId: "u1" },
      }),
    );

    const arg = infoSpy.mock.calls[0]?.[0];
    expect(typeof arg).toBe("string");
    const parsed = JSON.parse(arg as string);
    expect(parsed).toMatchObject({
      level: "info",
      msg: "with bindings",
      userId: "u1",
    });
  });

  it("includes a serialized error in JSON output", () => {
    const t = new ConsoleTransport({ channel: "console", pretty: false });
    const err = new Error("boom");

    t.write(fakeRecord({ level: "error", msg: "fail", err }));

    const parsed = JSON.parse(errorSpy.mock.calls[0]?.[0] as string);
    expect(parsed.err).toMatchObject({ type: "Error", message: "boom" });
    expect(typeof parsed.err.stack).toBe("string");
  });

  it("emits a colored single-line preamble in pretty mode", () => {
    const t = new ConsoleTransport({ channel: "console", pretty: true });

    t.write(
      fakeRecord({
        level: "warn",
        msg: "warning!",
        bindings: { route: "/api" },
      }),
    );

    const arg = warnSpy.mock.calls[0]?.[0] as string;
    expect(arg).toContain("WARN");
    expect(arg).toContain("warning!");
    expect(arg).toContain('"route":"/api"');
  });
});
