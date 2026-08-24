import { describe, expect, it, vi } from "vitest";

import { BaseSms } from "../base-sms";
import { FakeSender } from "../fake-sender";
import { SmsManager } from "../manager";

class GreetSms extends BaseSms {
  constructor(
    private readonly phone: string,
    private readonly name: string,
  ) {
    super();
  }
  prepare(): void {
    this.message.to(this.phone).content(`Hola ${this.name}`);
  }
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("SmsManager", () => {
  it("uses the default mailer when none specified", async () => {
    const logger = makeLogger();
    const manager = new SmsManager({
      default: "log",
      mailers: { log: { provider: "log", logger } },
      logger,
    });
    const res = await manager.send(new GreetSms("+5491155555555", "L"));
    expect(res.provider).toBe("log");
  });

  it("caches sender per mailer", () => {
    const logger = makeLogger();
    const manager = new SmsManager({
      default: "log",
      mailers: { log: { provider: "log", logger } },
      logger,
    });
    expect(manager.use("log")).toBe(manager.use("log"));
  });

  it("throws on unknown mailer", () => {
    const logger = makeLogger();
    const manager = new SmsManager({
      default: "log",
      mailers: { log: { provider: "log", logger } },
      logger,
    });
    expect(() =>
      // @ts-expect-error testing runtime guard
      manager.use("nope"),
    ).toThrow(/Unknown mailer/);
  });

  it("strips undefined mailers (conditional config)", () => {
    const logger = makeLogger();
    const manager = new SmsManager({
      default: "log",
      mailers: {
        log: { provider: "log", logger },
        twilio: undefined,
      },
      logger,
    });
    expect(() => manager.use("twilio" as "log")).toThrow(/Unknown mailer/);
  });

  it("fake() swaps the sender; restore() reverts", async () => {
    const logger = makeLogger();
    const manager = new SmsManager({
      default: "log",
      mailers: { log: { provider: "log", logger } },
      logger,
    });
    const fake = manager.fake();
    expect(fake).toBeInstanceOf(FakeSender);
    await manager.send(new GreetSms("+5491155555555", "L"));
    fake.assertSent(GreetSms);
    expect(fake.sentMessages).toHaveLength(1);

    manager.restore();
    const res = await manager.send(new GreetSms("+5491155555555", "L"));
    expect(res.provider).toBe("log");
  });
});
