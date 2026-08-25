import { describe, expect, it, vi } from "vitest";

import { BaseEmail } from "../base-email";
import { FakeSender } from "../fake-sender";
import { EmailMessage } from "../email-message";
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

describe("queue wiring", () => {
  // A block body, not an arrow expression: the builder chains and returns
  // itself, and `EmailComposeCallback` is typed to return void.
  const compose = (m: EmailMessage) => {
    m.to("a@b.com").subject("s").html("<p>h</p>");
  };

  it("passes a configured queue through to the transport", async () => {
    /*
     * Regression. The constructor rebuilt `#config` from a hand-written list of
     * fields, so `queue` was dropped on the way in and every send fell through
     * to the local mailer. TypeScript could not see it: the narrower object
     * still satisfies the type, because `queue` is optional.
     *
     * The symptom was maddening to chase — the app config was right, the
     * environment was right, and mail still went to a file.
     */
    const dispatch = vi.fn().mockResolvedValue({ id: "run_1" });

    const manager = new EmailManager({
      default: "log",
      mailers: { log: { provider: "log", logger: { info() {}, warn() {}, error() {} } } },
      queue: { mailer: "resend", dispatch },
    });

    const response = await manager.send(compose);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(response.status).toBe("queued");
    // The destination the worker will use, not "queue" and not the local
    // mailer key — logs that disagree with themselves are their own bug.
    expect(response.provider).toBe("resend");
  });

  it("delivers through the chosen mailer when no queue is configured", async () => {
    const manager = new EmailManager({
      default: "log",
      mailers: { log: { provider: "log", logger: { info() {}, warn() {}, error() {} } } },
    });

    const response = await manager.send(compose);

    expect(response.status).toBe("sent");
    expect(response.provider).toBe("log");
  });
});
