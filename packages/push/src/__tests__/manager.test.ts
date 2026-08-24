import { describe, expect, it, vi } from "vitest";

import { BasePush } from "../base-push";
import { FakeSender } from "../fake-sender";
import { PushManager } from "../manager";

class StampEarnedPush extends BasePush {
  constructor(private readonly userId: string) {
    super();
  }
  prepare(): void {
    this.message.toUser(this.userId).title("Order shipped").body("Nice!");
  }
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("PushManager", () => {
  it("uses the default sender when none specified", async () => {
    const logger = makeLogger();
    const manager = new PushManager({
      default: "log",
      senders: { log: { provider: "log", logger } },
      logger,
    });
    const responses = await manager.send((m) => {
      m.toToken("ExponentPushToken[abc]", "expo").title("Hi").body("Body");
    });
    expect(responses[0]?.provider).toBe("log");
  });

  it("caches sender per name", () => {
    const logger = makeLogger();
    const manager = new PushManager({
      default: "log",
      senders: { log: { provider: "log", logger } },
      logger,
    });
    expect(manager.use("log")).toBe(manager.use("log"));
  });

  it("throws on unknown sender", () => {
    const logger = makeLogger();
    const manager = new PushManager({
      default: "log",
      senders: { log: { provider: "log", logger } },
      logger,
    });
    expect(() =>
      // @ts-expect-error testing runtime guard
      manager.use("nope"),
    ).toThrow(/Unknown sender/);
  });

  it("strips undefined senders (conditional config)", () => {
    const logger = makeLogger();
    const manager = new PushManager({
      default: "log",
      senders: {
        log: { provider: "log", logger },
        webpush: undefined,
      },
      logger,
    });
    expect(() => manager.use("webpush" as "log")).toThrow(/Unknown sender/);
  });

  it("fake() swaps the sender; restore() reverts", async () => {
    const logger = makeLogger();
    const manager = new PushManager({
      default: "log",
      senders: { log: { provider: "log", logger } },
      logger,
    });
    const fake = manager.fake();
    expect(fake).toBeInstanceOf(FakeSender);
    await manager.send(new StampEarnedPush("u_1"));
    fake.assertSent(StampEarnedPush);
    expect(fake.sentMessages).toHaveLength(1);

    manager.restore();
    const res = await manager.send((m) => {
      m.toToken("ExponentPushToken[xyz]", "expo").title("Hi").body("Body");
    });
    expect(res[0]?.provider).toBe("log");
  });
});
