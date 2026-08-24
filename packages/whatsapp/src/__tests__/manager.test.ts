import { describe, expect, it, vi } from "vitest";
import { BaseWhatsApp } from "../base-whatsapp";
import { FakeSender } from "../fake-sender";
import { WhatsAppManager } from "../manager";

class GreetWhatsApp extends BaseWhatsApp {
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

describe("WhatsAppManager", () => {
  it("uses the default mailer when none specified", async () => {
    const logger = makeLogger();
    const manager = new WhatsAppManager({
      default: "log",
      mailers: { log: { provider: "log", logger } },
      logger,
    });
    const res = await manager.send(new GreetWhatsApp("+5491155555555", "L"));
    expect(res.provider).toBe("log");
  });

  it("caches sender per mailer", () => {
    const logger = makeLogger();
    const manager = new WhatsAppManager({
      default: "log",
      mailers: { log: { provider: "log", logger } },
      logger,
    });
    expect(manager.use("log")).toBe(manager.use("log"));
  });

  it("throws on unknown mailer", () => {
    const logger = makeLogger();
    const manager = new WhatsAppManager({
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
    const manager = new WhatsAppManager({
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
    const manager = new WhatsAppManager({
      default: "log",
      mailers: { log: { provider: "log", logger } },
      logger,
    });
    const fake = manager.fake();
    expect(fake).toBeInstanceOf(FakeSender);
    await manager.send(new GreetWhatsApp("+5491155555555", "L"));
    fake.assertSent(GreetWhatsApp);
    expect(fake.sentMessages).toHaveLength(1);

    manager.restore();
    // After restore the new send goes back through the real (log) transport.
    const res = await manager.send(
      new GreetWhatsApp("+5491155555555", "L"),
    );
    expect(res.provider).toBe("log");
  });
});
