import { describe, expect, it } from "vitest";

import { BaseEmail } from "../base-email";
import { FakeSender } from "../fake-sender";

class AlphaEmail extends BaseEmail {
  constructor(private readonly addr: string) {
    super();
  }
  prepare(): void {
    this.message
      .to(this.addr)
      .from("notifications@acme.app")
      .subject("alpha")
      .text("alpha");
  }
}

class BetaEmail extends BaseEmail {
  constructor(private readonly addr: string) {
    super();
  }
  prepare(): void {
    this.message
      .to(this.addr)
      .from("notifications@acme.app")
      .subject("beta")
      .text("beta");
  }
}

describe("FakeSender", () => {
  it("captures instances and compiled messages", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaEmail("a@example.com"));
    await fake.send((m) => {
      m.to("a@example.com")
        .from("notifications@acme.app")
        .subject("inline")
        .text("inline");
    });

    expect(fake.sent).toHaveLength(1);
    expect(fake.sentMessages).toHaveLength(2);
  });

  it("assertSent / assertNotSent by class", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaEmail("a@example.com"));

    fake.assertSent(AlphaEmail);
    fake.assertNotSent(BetaEmail);
    expect(() => fake.assertNotSent(AlphaEmail)).toThrow();
    expect(() => fake.assertSent(BetaEmail)).toThrow();
  });

  it("assertSent with predicate", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaEmail("a@example.com"));

    fake.assertSent(AlphaEmail, (m) => {
      const data = m.message.toData();
      const first = data.to[0];
      return (typeof first === "string" ? first : first?.address) === "a@example.com";
    });
    expect(() =>
      fake.assertSent(AlphaEmail, (m) => {
        const data = m.message.toData();
        const first = data.to[0];
        return (typeof first === "string" ? first : first?.address) === "b@example.com";
      }),
    ).toThrow();
  });

  it("assertSentCount total + per-class", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaEmail("a@example.com"));
    await fake.send(new AlphaEmail("b@example.com"));
    await fake.send(new BetaEmail("c@example.com"));

    fake.assertSentCount(3);
    fake.assertSentCount(AlphaEmail, 2);
    fake.assertSentCount(BetaEmail, 1);
    expect(() => fake.assertSentCount(99)).toThrow();
  });

  it("clear() empties the captured lists", async () => {
    const fake = new FakeSender();
    await fake.send(new AlphaEmail("a@example.com"));
    fake.clear();
    fake.assertNoneSent();
    expect(fake.sentMessages).toHaveLength(0);
  });
});
