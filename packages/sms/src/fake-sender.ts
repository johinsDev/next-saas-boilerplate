import type { BaseSms } from "./base-sms";
import { SmsSender } from "./sender";
import type {
  SmsComposeCallback,
  SmsMessageData,
  SmsResponse,
  SmsTransport,
} from "./types";

const fakeTransport: SmsTransport = {
  name: "fake",
  async send(_data: SmsMessageData): Promise<SmsResponse> {
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
 * assert on it. Activated via `smsManager.fake()`.
 *
 * @example
 *   const fake = sms.fake();
 *   await runFlowThatSendsOtp();
 *   fake.assertSent(OtpSms, (m) => m.message.toData().to === "+5491155555555");
 *   sms.restore();
 */
export class FakeSender extends SmsSender {
  readonly sent: BaseSms[] = [];
  readonly sentMessages: SmsMessageData[] = [];

  constructor() {
    super("fake", fakeTransport, { logLevel: "silent" });
  }

  override async send(
    callbackOrSms: SmsComposeCallback | BaseSms,
  ): Promise<SmsResponse> {
    if (typeof callbackOrSms !== "function") {
      this.sent.push(callbackOrSms);
    }
    return super.send(callbackOrSms);
  }

  override async sendCompiled(data: SmsMessageData): Promise<SmsResponse> {
    this.sentMessages.push(data);
    return super.sendCompiled(data);
  }

  clear(): void {
    this.sent.length = 0;
    this.sentMessages.length = 0;
  }

  assertSent<T extends new (...args: never[]) => BaseSms>(
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

  assertNotSent<T extends new (...args: never[]) => BaseSms>(
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
    cls: new (...args: never[]) => BaseSms,
    count: number,
  ): this;
  assertSentCount(
    clsOrCount: (new (...args: never[]) => BaseSms) | number,
    count?: number,
  ): this {
    if (typeof clsOrCount === "number") {
      if (this.sent.length !== clsOrCount) {
        throw new Error(
          `Expected ${clsOrCount} SMS messages sent, got ${this.sent.length}`,
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
      throw new Error(`Expected no SMS messages sent, got: ${names}`);
    }
    return this;
  }
}
