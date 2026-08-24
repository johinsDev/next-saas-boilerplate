import { describe, expect, it } from "vitest";

import { BasePush } from "../base-push";
import { FakeSender } from "../fake-sender";

class StampEarnedPush extends BasePush {
  constructor(private readonly userId: string) {
    super();
  }
  prepare(): void {
    this.message.toUser(this.userId).title("Order shipped").body("Nice!");
  }
}

class OtherPush extends BasePush {
  prepare(): void {
    this.message
      .toToken("ExponentPushToken[other]", "expo")
      .title("Other")
      .body("Other body");
  }
}

describe("FakeSender", () => {
  it("records BasePush instances", async () => {
    const fake = new FakeSender();
    await fake.send(new StampEarnedPush("u_1"));
    expect(fake.sent).toHaveLength(1);
    expect(fake.sentMessages).toHaveLength(1);
    expect(fake.sentMessages[0]?.title).toBe("Order shipped");
  });

  it("records callback-style sends only in sentMessages", async () => {
    const fake = new FakeSender();
    await fake.send((m) => {
      m.toToken("ExponentPushToken[abc]", "expo").title("Hi").body("Body");
    });
    expect(fake.sent).toHaveLength(0);
    expect(fake.sentMessages).toHaveLength(1);
  });

  it("assertSent by class", async () => {
    const fake = new FakeSender();
    await fake.send(new StampEarnedPush("u_1"));
    fake.assertSent(StampEarnedPush);
    expect(() => fake.assertSent(OtherPush)).toThrow(/Expected "OtherPush"/);
  });

  it("assertSent with predicate", async () => {
    const fake = new FakeSender();
    await fake.send(new StampEarnedPush("u_1"));
    fake.assertSent(StampEarnedPush, (p) =>
      p.message.toData().recipients.some((r) => r.kind === "user" && r.userId === "u_1"),
    );
  });

  it("assertNotSent", async () => {
    const fake = new FakeSender();
    await fake.send(new StampEarnedPush("u_1"));
    fake.assertNotSent(OtherPush);
    expect(() => fake.assertNotSent(StampEarnedPush)).toThrow();
  });

  it("assertSentCount (total)", async () => {
    const fake = new FakeSender();
    await fake.send(new StampEarnedPush("u_1"));
    await fake.send(new OtherPush());
    fake.assertSentCount(2);
    expect(() => fake.assertSentCount(1)).toThrow();
  });

  it("assertSentCount (per class)", async () => {
    const fake = new FakeSender();
    await fake.send(new StampEarnedPush("u_1"));
    await fake.send(new StampEarnedPush("u_2"));
    await fake.send(new OtherPush());
    fake.assertSentCount(StampEarnedPush, 2);
    fake.assertSentCount(OtherPush, 1);
  });

  it("assertNoneSent", async () => {
    const fake = new FakeSender();
    fake.assertNoneSent();
    await fake.send(new StampEarnedPush("u_1"));
    expect(() => fake.assertNoneSent()).toThrow();
  });

  it("clear() resets state", async () => {
    const fake = new FakeSender();
    await fake.send(new StampEarnedPush("u_1"));
    fake.clear();
    expect(fake.sent).toHaveLength(0);
    expect(fake.sentMessages).toHaveLength(0);
  });

  it("assertSentTo by token", async () => {
    const fake = new FakeSender();
    await fake.send((m) => {
      m.toToken("ExponentPushToken[needle]", "expo").title("Hi").body("Body");
    });
    fake.assertSentTo("ExponentPushToken[needle]");
    expect(() => fake.assertSentTo("ExponentPushToken[missing]")).toThrow();
  });

  it("assertSentTo by userId", async () => {
    const fake = new FakeSender();
    await fake.send(new StampEarnedPush("u_42"));
    fake.assertSentTo("u_42");
  });
});
