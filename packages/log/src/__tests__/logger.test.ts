import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeLogger } from "../fake-logger";
import { Logger } from "../logger";
import type { LogLevel, LogTransport } from "../types";

function buildLogger(transport: LogTransport, opts?: { minLevel?: LogLevel }) {
  return new Logger({
    channel: "test",
    transport,
    minLevel: opts?.minLevel ?? "trace",
    bindings: { service: "loy-test" },
  });
}

describe("Logger", () => {
  let fake: FakeLogger;

  beforeEach(() => {
    fake = new FakeLogger();
  });

  it("emits a record per level method", () => {
    const logger = buildLogger(fake);

    logger.trace("trace msg");
    logger.debug("debug msg");
    logger.info("info msg");
    logger.warn("warn msg");
    logger.error("error msg");
    logger.fatal("fatal msg");

    expect(fake.records.map((r) => r.level)).toEqual([
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
    ]);
  });

  it("merges call-site bindings into base bindings", () => {
    const logger = buildLogger(fake);

    logger.info({ requestId: "r1" }, "with bindings");

    expect(fake.records[0]?.bindings).toEqual({
      service: "loy-test",
      requestId: "r1",
    });
  });

  it("treats first arg as message when it is a string", () => {
    const logger = buildLogger(fake);

    logger.info("plain message");

    expect(fake.records[0]?.msg).toBe("plain message");
    expect(fake.records[0]?.bindings).toEqual({ service: "loy-test" });
  });

  it("captures errors passed positionally for error/fatal", () => {
    const logger = buildLogger(fake);
    const boom = new Error("boom");

    logger.error(boom, "operation failed");

    expect(fake.records[0]?.err).toBe(boom);
    expect(fake.records[0]?.msg).toBe("operation failed");
  });

  it("falls back to error.message when no explicit message is given", () => {
    const logger = buildLogger(fake);
    const boom = new Error("kaboom");

    logger.error(boom);

    expect(fake.records[0]?.msg).toBe("kaboom");
    expect(fake.records[0]?.err).toBe(boom);
  });

  it("captures errors passed via bindings.err", () => {
    const logger = buildLogger(fake);
    const boom = new Error("nested");

    logger.error({ requestId: "r2", err: boom }, "wrapped");

    expect(fake.records[0]?.err).toBe(boom);
    expect(fake.records[0]?.bindings).toMatchObject({ requestId: "r2" });
  });

  it("filters records below minLevel", () => {
    const logger = buildLogger(fake, { minLevel: "warn" });

    logger.info("noisy");
    logger.debug("noisy");
    logger.warn("kept");
    logger.error("kept");

    expect(fake.records.map((r) => r.msg)).toEqual(["kept", "kept"]);
  });

  it("child() inherits parent bindings without mutating it", () => {
    const logger = buildLogger(fake);
    const child = logger.child({ requestId: "r3" });

    child.info("child line");
    logger.info("parent line");

    expect(fake.records[0]?.bindings).toEqual({
      service: "loy-test",
      requestId: "r3",
    });
    expect(fake.records[1]?.bindings).toEqual({ service: "loy-test" });
  });

  it("delegates flush to the underlying transport", async () => {
    const flush = vi.fn();
    const transport: LogTransport = {
      name: "stub",
      write: vi.fn(),
      flush,
    };
    const logger = buildLogger(transport);

    await logger.flush();

    expect(flush).toHaveBeenCalledOnce();
  });

  it("use() returns the sibling Logger from the resolver", () => {
    const sibling = buildLogger(fake);
    const resolveChannel = vi.fn(() => sibling);
    const logger = new Logger({
      channel: "default",
      transport: fake,
      minLevel: "trace",
      bindings: { service: "loy-test" },
      resolveChannel,
    });

    const result = logger.use("audit");

    expect(resolveChannel).toHaveBeenCalledWith("audit");
    expect(result).toBe(sibling);
  });

  it("use() throws when no resolver was supplied", () => {
    const logger = buildLogger(fake);
    expect(() => logger.use("audit")).toThrow(/requires a LogManager/);
  });

  it("child() inherits the resolver so use() still works after child()", () => {
    const sibling = buildLogger(fake);
    const resolveChannel = vi.fn(() => sibling);
    const logger = new Logger({
      channel: "default",
      transport: fake,
      minLevel: "trace",
      bindings: { service: "loy-test" },
      resolveChannel,
    });

    expect(() => logger.child({ requestId: "r1" }).use("audit")).not.toThrow();
    expect(resolveChannel).toHaveBeenCalledWith("audit");
  });
});
