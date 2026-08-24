import type { BaseEmail } from "./base-email";
import { EmailSender } from "./sender";
import type {
  EmailComposeCallback,
  EmailMessageData,
  EmailResponse,
  EmailTransport,
} from "./types";

const fakeTransport: EmailTransport = {
  name: "fake",
  async send(_data: EmailMessageData): Promise<EmailResponse> {
    return {
      status: "sent",
      provider: "fake",
      providerMessageId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
  },
};

/**
 * In-memory sender for tests. Captures every send so the test can
 * assert on it. Activated via `emailManager.fake()`.
 *
 * @example
 *   const fake = email.fake();
 *   await runFlowThatSendsWelcomeEmail();
 *   fake.assertSent(
 *     WelcomeEmail,
 *     (m) => m.message.toData().to.some((r) =>
 *       (typeof r === "string" ? r : r.address) === "lucia@example.com",
 *     ),
 *   );
 *   email.restore();
 */
export class FakeSender extends EmailSender {
  readonly sent: BaseEmail[] = [];
  readonly sentMessages: EmailMessageData[] = [];

  constructor() {
    super("fake", fakeTransport, { logLevel: "silent" });
  }

  override async send(
    callbackOrEmail: EmailComposeCallback | BaseEmail,
  ): Promise<EmailResponse> {
    if (typeof callbackOrEmail !== "function") {
      this.sent.push(callbackOrEmail);
    }
    return super.send(callbackOrEmail);
  }

  override async sendCompiled(data: EmailMessageData): Promise<EmailResponse> {
    this.sentMessages.push(data);
    return super.sendCompiled(data);
  }

  clear(): void {
    this.sent.length = 0;
    this.sentMessages.length = 0;
  }

  assertSent<T extends new (...args: never[]) => BaseEmail>(
    cls: T,
    findFn?: (msg: InstanceType<T>) => boolean,
  ): this {
    const match = this.sent.find((m) => {
      if (!(m instanceof cls)) return false;
      return findFn ? findFn(m as InstanceType<T>) : true;
    });
    if (!match) throw new Error(`Expected "${cls.name}" to have been sent`);
    return this;
  }

  assertNotSent<T extends new (...args: never[]) => BaseEmail>(
    cls: T,
    findFn?: (msg: InstanceType<T>) => boolean,
  ): this {
    const match = this.sent.find((m) => {
      if (!(m instanceof cls)) return false;
      return findFn ? findFn(m as InstanceType<T>) : true;
    });
    if (match) throw new Error(`Unexpected "${cls.name}" was sent`);
    return this;
  }

  assertSentCount(count: number): this;
  assertSentCount(
    cls: new (...args: never[]) => BaseEmail,
    count: number,
  ): this;
  assertSentCount(
    clsOrCount: (new (...args: never[]) => BaseEmail) | number,
    count?: number,
  ): this {
    if (typeof clsOrCount === "number") {
      if (this.sent.length !== clsOrCount) {
        throw new Error(
          `Expected ${clsOrCount} emails sent, got ${this.sent.length}`,
        );
      }
      return this;
    }
    const actual = this.sent.filter((m) => m instanceof clsOrCount).length;
    if (actual !== count) {
      throw new Error(
        `Expected "${clsOrCount.name}" sent ${count} times, got ${actual}`,
      );
    }
    return this;
  }

  assertNoneSent(): this {
    if (this.sent.length > 0) {
      const names = this.sent.map((m) => m.constructor.name).join(", ");
      throw new Error(`Expected no emails sent, got: ${names}`);
    }
    return this;
  }
}
