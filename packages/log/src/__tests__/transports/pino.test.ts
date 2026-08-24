import { describe, expect, it, vi } from "vitest";
import { fakeRecord } from "../../factories";
import { PinoTransport } from "../../transports/pino";

function pinoStub() {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    flush: vi.fn(),
  };
}

describe("PinoTransport", () => {
  it("uses an injected pre-built instance", async () => {
    const instance = pinoStub();
    const t = new PinoTransport({ channel: "pino", instance });

    await t.write(fakeRecord({ level: "info", msg: "hi", bindings: { x: 1 } }));

    expect(instance.info).toHaveBeenCalledWith({ x: 1 }, "hi");
  });

  it("routes by level to the matching pino method", async () => {
    const instance = pinoStub();
    const t = new PinoTransport({ channel: "pino", instance });

    await t.write(fakeRecord({ level: "trace", msg: "t" }));
    await t.write(fakeRecord({ level: "debug", msg: "d" }));
    await t.write(fakeRecord({ level: "info", msg: "i" }));
    await t.write(fakeRecord({ level: "warn", msg: "w" }));
    await t.write(fakeRecord({ level: "error", msg: "e" }));
    await t.write(fakeRecord({ level: "fatal", msg: "f" }));

    expect(instance.trace).toHaveBeenCalledOnce();
    expect(instance.debug).toHaveBeenCalledOnce();
    expect(instance.info).toHaveBeenCalledOnce();
    expect(instance.warn).toHaveBeenCalledOnce();
    expect(instance.error).toHaveBeenCalledOnce();
    expect(instance.fatal).toHaveBeenCalledOnce();
  });

  it("attaches err to the bindings object", async () => {
    const instance = pinoStub();
    const t = new PinoTransport({ channel: "pino", instance });
    const boom = new Error("boom");

    await t.write(fakeRecord({ level: "error", msg: "fail", err: boom }));

    expect(instance.error).toHaveBeenCalledWith({ err: boom }, "fail");
  });

  it("lazily builds via setFactory when no instance is supplied", async () => {
    const instance = pinoStub();
    const factory = vi.fn(() => instance);
    const t = new PinoTransport({ channel: "pino", options: { level: "trace" } });
    t.setFactory(factory);

    await t.write(fakeRecord({ level: "info", msg: "hi" }));
    await t.write(fakeRecord({ level: "info", msg: "hi again" }));

    expect(factory).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledWith({ level: "trace" });
    expect(instance.info).toHaveBeenCalledTimes(2);
  });

  it("flush() forwards to the underlying instance", async () => {
    const instance = pinoStub();
    const t = new PinoTransport({ channel: "pino", instance });

    await t.flush();

    expect(instance.flush).toHaveBeenCalledOnce();
  });
});
