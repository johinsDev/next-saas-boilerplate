import { describe, expect, it, vi } from "vitest";

import { BaseEmail } from "../base-email";
import { FakeSender } from "../fake-sender";
import { EmailManager } from "../manager";

class GreetEmail extends BaseEmail {
  constructor(
    private readonly addr: string,
    private readonly name: string,
  ) {
    super();
  }
  prepare(): void {
    this.message
      .to(this.addr)
      .from("notifications@acme.app")
      .subject(`Hola ${this.name}`)
      .text(`Hola ${this.name}`);
  }
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("EmailManager", () => {
  it("uses the default mailer when none specified", async () => {
    const logger = makeLogger();
    const manager = new EmailManager({
      default: "log",
      mailers: { log: { provider: "log", logger } },
      logger,
    });
    const res = await manager.send(new GreetEmail("a@example.com", "Lu"));
    expect(res.provider).toBe("log");
  });

  it("caches sender per mailer", () => {
    const logger = makeLogger();
    const manager = new EmailManager({
      default: "log",
      mailers: { log: { provider: "log", logger } },
      logger,
    });
    expect(manager.use("log")).toBe(manager.use("log"));
  });

  it("throws on unknown mailer", () => {
    const logger = makeLogger();
    const manager = new EmailManager({
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
    const manager = new EmailManager({
      default: "log",
      mailers: {
        log: { provider: "log", logger },
        resend: undefined,
      },
      logger,
    });
    expect(() => manager.use("resend" as "log")).toThrow(/Unknown mailer/);
  });

  it("fake() swaps the sender; restore() reverts", async () => {
    const logger = makeLogger();
    const manager = new EmailManager({
      default: "log",
      mailers: { log: { provider: "log", logger } },
      logger,
    });
    const fake = manager.fake();
    expect(fake).toBeInstanceOf(FakeSender);
    await manager.send(new GreetEmail("a@example.com", "Lu"));
    fake.assertSent(GreetEmail);
    expect(fake.sentMessages).toHaveLength(1);

    manager.restore();
    const res = await manager.send(new GreetEmail("a@example.com", "Lu"));
    expect(res.provider).toBe("log");
  });
});
