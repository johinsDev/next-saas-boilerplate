import type { BaseWhatsApp } from "./base-whatsapp";
import { WhatsAppSender } from "./sender";
import type {
  WhatsAppComposeCallback,
  WhatsAppMessageData,
  WhatsAppResponse,
  WhatsAppTransport,
} from "./types";

const fakeTransport: WhatsAppTransport = {
  name: "fake",
  async send(_data: WhatsAppMessageData): Promise<WhatsAppResponse> {
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
 * assert on it. Activated via `whatsappManager.fake()`.
 *
 * @example
 *   const fake = whatsapp.fake();
 *   await runFlowThatSendsBirthdayMessage();
 *   fake.assertSent(BirthdayWhatsApp, (m) => m.message.toData().to === "+5491155555555");
 *   whatsapp.restore();
 */
export class FakeSender extends WhatsAppSender {
  readonly sent: BaseWhatsApp[] = [];
  readonly sentMessages: WhatsAppMessageData[] = [];

  constructor() {
    super("fake", fakeTransport, { logLevel: "silent" });
  }

  override async send(
    callbackOrWhatsApp: WhatsAppComposeCallback | BaseWhatsApp,
  ): Promise<WhatsAppResponse> {
    if (typeof callbackOrWhatsApp !== "function") {
      this.sent.push(callbackOrWhatsApp);
    }
    return super.send(callbackOrWhatsApp);
  }

  override async sendCompiled(
    data: WhatsAppMessageData,
  ): Promise<WhatsAppResponse> {
    this.sentMessages.push(data);
    return super.sendCompiled(data);
  }

  clear(): void {
    this.sent.length = 0;
    this.sentMessages.length = 0;
  }

  assertSent<T extends new (...args: never[]) => BaseWhatsApp>(
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

  assertNotSent<T extends new (...args: never[]) => BaseWhatsApp>(
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
    cls: new (...args: never[]) => BaseWhatsApp,
    count: number,
  ): this;
  assertSentCount(
    clsOrCount: (new (...args: never[]) => BaseWhatsApp) | number,
    count?: number,
  ): this {
    if (typeof clsOrCount === "number") {
      if (this.sent.length !== clsOrCount) {
        throw new Error(
          `Expected ${clsOrCount} WhatsApp messages sent, got ${this.sent.length}`,
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
      throw new Error(`Expected no WhatsApp messages sent, got: ${names}`);
    }
    return this;
  }
}
