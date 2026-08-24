import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnknownChannelError } from "../errors";
import { LogManager } from "../log-manager";
import type { ChannelConfig } from "../types";

const channels = {
  silent: { channel: "silent" } as const,
  console: { channel: "console", pretty: false } as const,
  pino: { channel: "pino" } as const,
} satisfies Record<string, ChannelConfig>;

describe("LogManager", () => {
  let manager: LogManager<typeof channels>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    manager = new LogManager({
      default: "silent",
      channels,
      minLevel: "info",
      baseBindings: { service: "loy" },
    });
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    manager.restore();
  });

  it("returns a Logger that writes to the configured channel", () => {
    manager.use("console").info("hello");
    expect(consoleInfoSpy).toHaveBeenCalledOnce();
  });

  it("caches loggers by channel name", () => {
    const a = manager.use("console");
    const b = manager.use("console");
    expect(a).toBe(b);
  });

  it("throws UnknownChannelError for missing channel names", () => {
    expect(() => manager.use("nope" as never)).toThrow(UnknownChannelError);
  });

  it("setDefault() swaps the active channel and resolves on next call", () => {
    manager.setDefault("console");
    manager.logger().info("default route");
    expect(consoleInfoSpy).toHaveBeenCalledOnce();
  });

  it("setMinLevel() rebuilds loggers and applies new floor", () => {
    const before = manager.use("console");
    manager.setMinLevel("error");
    const after = manager.use("console");

    expect(after).not.toBe(before);
    after.info("dropped");
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });

  it("setBaseBindings() updates bindings on next use()", () => {
    manager.setBaseBindings({ service: "loy", env: "test" });
    const fake = manager.fake();
    manager.use("console").info("with bindings");
    expect(fake.records[0]?.bindings).toEqual({ service: "loy", env: "test" });
  });

  it("logger() returns a child logger when bindings are passed", () => {
    const fake = manager.fake();
    manager.logger({ requestId: "r9" }).info("scoped");
    expect(fake.records[0]?.bindings).toEqual({ service: "loy", requestId: "r9" });
  });

  it("fake() routes every channel through the FakeLogger", () => {
    const fake = manager.fake();

    manager.use("console").info("via console");
    manager.use("pino").error("via pino");

    expect(fake.records).toHaveLength(2);
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });

  it("restore() rebuilds real transports", () => {
    manager.fake();
    manager.use("console").info("ignored");
    manager.restore();
    manager.use("console").info("real now");
    expect(consoleInfoSpy).toHaveBeenCalledOnce();
  });

  it("channels() lists configured channel names", () => {
    expect(manager.channels().sort()).toEqual(["console", "pino", "silent"]);
  });

  it("logger.use(channel) resolves to the manager's sibling channel", () => {
    const fake = manager.fake();
    manager.logger().use("console").info("audit-style line");
    expect(fake.records).toHaveLength(1);
    expect(fake.records[0]?.msg).toBe("audit-style line");
  });

  it("logger.use(unknown) throws UnknownChannelError", () => {
    expect(() => manager.logger().use("nope" as never)).toThrow(
      UnknownChannelError,
    );
  });
});
