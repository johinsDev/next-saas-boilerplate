import { describe, expect, it } from "vitest";
import { BaseWhatsApp } from "../base-whatsapp";
import { FakeSender } from "../fake-sender";

class AlphaWhatsApp extends BaseWhatsApp {
  constructor(private readonly phone: string) {
    super();
  }
  prepare(): void {
    this.message.to(this.phone).content("alpha");
  }
}

class BetaWhatsApp extends BaseWhatsApp {
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
    await fake.send(new AlphaWhatsApp("+5491155555555"));
    await fake.send((m) => {
      m.to("+5491155555555").content("inline");
    });

    expect(fake.sent).toHaveLength(1);
    expect(fake.sentMessages).toHaveLength(2);
  });

  it("assertSent / assertNotSent by class", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaWhatsApp("+5491155555555"));

    fake.assertSent(AlphaWhatsApp);
    fake.assertNotSent(BetaWhatsApp);
    expect(() => fake.assertNotSent(AlphaWhatsApp)).toThrow();
    expect(() => fake.assertSent(BetaWhatsApp)).toThrow();
  });

  it("assertSent with predicate", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaWhatsApp("+5491155555555"));

    fake.assertSent(
      AlphaWhatsApp,
      (m) => m.message.toData().to === "+5491155555555",
    );
    expect(() =>
      fake.assertSent(
        AlphaWhatsApp,
        (m) => m.message.toData().to === "+1111111111",
      ),
    ).toThrow();
  });

  it("assertSentCount total and per-class", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaWhatsApp("+5491155555555"));
    await fake.send(new AlphaWhatsApp("+5491100000000"));
    await fake.send(new BetaWhatsApp("+5491155555555"));

    fake.assertSentCount(3);
    fake.assertSentCount(AlphaWhatsApp, 2);
    fake.assertSentCount(BetaWhatsApp, 1);
    expect(() => fake.assertSentCount(99)).toThrow();
  });

  it("clear() empties the captured lists", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaWhatsApp("+5491155555555"));
    fake.clear();
    fake.assertNoneSent();
    expect(fake.sentMessages).toHaveLength(0);
  });
});
