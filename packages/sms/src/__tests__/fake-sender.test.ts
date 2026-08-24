import { describe, expect, it } from "vitest";

import { BaseSms } from "../base-sms";
import { FakeSender } from "../fake-sender";

class AlphaSms extends BaseSms {
  constructor(private readonly phone: string) {
    super();
  }
  prepare(): void {
    this.message.to(this.phone).content("alpha");
  }
}

class BetaSms extends BaseSms {
  constructor(private readonly phone: string) {
    super();
  }
  prepare(): void {
    this.message.to(this.phone).content("beta");
  }
}

describe("FakeSender", () => {
  it("captures class instances and compiled messages", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaSms("+5491155555555"));
    await fake.send((m) => {
      m.to("+5491155555555").content("inline");
    });

    expect(fake.sent).toHaveLength(1);
    expect(fake.sentMessages).toHaveLength(2);
  });

  it("assertSent / assertNotSent by class", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaSms("+5491155555555"));

    fake.assertSent(AlphaSms);
    fake.assertNotSent(BetaSms);
    expect(() => fake.assertNotSent(AlphaSms)).toThrow();
    expect(() => fake.assertSent(BetaSms)).toThrow();
  });

  it("assertSent with predicate", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaSms("+5491155555555"));

    fake.assertSent(
      AlphaSms,
      (m) => m.message.toData().to === "+5491155555555",
    );
    expect(() =>
      fake.assertSent(
        AlphaSms,
        (m) => m.message.toData().to === "+1111111111",
      ),
    ).toThrow();
  });

  it("assertSentCount total and per-class", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaSms("+5491155555555"));
    await fake.send(new AlphaSms("+5491100000000"));
    await fake.send(new BetaSms("+5491155555555"));

    fake.assertSentCount(3);
    fake.assertSentCount(AlphaSms, 2);
    fake.assertSentCount(BetaSms, 1);
    expect(() => fake.assertSentCount(99)).toThrow();
  });

  it("clear() empties the captured lists", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaSms("+5491155555555"));
    fake.clear();
    fake.assertNoneSent();
    expect(fake.sentMessages).toHaveLength(0);
  });
});
