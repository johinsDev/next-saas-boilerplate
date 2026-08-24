import { describe, expect, it } from "vitest";
import { fakeManager, fakeRecord, resetFakeRecordCounter } from "../factories";

describe("factories", () => {
  it("fakeRecord produces deterministic timestamps", () => {
    resetFakeRecordCounter();
    const a = fakeRecord();
    const b = fakeRecord();
    expect(b.time - a.time).toBe(1);
  });

  it("fakeRecord honors overrides", () => {
    const r = fakeRecord({
      level: "warn",
      msg: "watch",
      bindings: { x: 1 },
    });
    expect(r.level).toBe("warn");
    expect(r.msg).toBe("watch");
    expect(r.bindings).toEqual({ x: 1 });
  });

  it("fakeManager defaults to silent and accepts overrides", () => {
    const manager = fakeManager();
    expect(manager.channels().sort()).toEqual(["console", "silent"]);

    const customManager = fakeManager({
      baseBindings: { service: "custom" },
    });
    const fake = customManager.fake();
    customManager.logger().info("hi");
    expect(fake.records[0]?.bindings).toEqual({ service: "custom" });
  });
});
