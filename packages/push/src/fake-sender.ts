import type { BasePush } from "./base-push";
import { PushSender } from "./sender";
import type {
  PushComposeCallback,
  PushMessageData,
  PushRecipient,
  PushResponse,
  PushTransport,
  ResolvedRecipient,
} from "./types";

const fakeTransport: PushTransport = {
  name: "fake",
  async send(
    _data: PushMessageData,
    recipient: ResolvedRecipient,
  ): Promise<PushResponse> {
    return {
      status: "sent",
      provider: "fake",
      platform: recipient.platform,
      token: recipient.token,
      providerMessageId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
  },
};

function tokenMatches(recipient: PushRecipient, needle: string): boolean {
  if (recipient.kind === "token") return recipient.token === needle;
  return recipient.userId === needle;
}

/**
 * In-memory sender for tests. Captures every send so the test can
 * assert on it. Activated via `pushManager.fake()`.
 *
 * @example
 *   const fake = push.fake();
 *   await runFlowThatSendsStampEarnedPush();
 *   fake.assertSent(StampEarnedPush, (p) =>
 *     p.message.toData().recipients.some((r) =>
 *       r.kind === "user" && r.userId === "u_123",
 *     ),
 *   );
 *   push.restore();
 */
export class FakeSender extends PushSender {
  readonly sent: BasePush[] = [];
  readonly sentMessages: PushMessageData[] = [];

  constructor() {
    super("fake", fakeTransport, {
      logLevel: "silent",
      // Fake doesn't resolve users — tests assert on the message shape directly.
      tokenLookup: async () => [],
    });
  }

  override async send(
    callbackOrPush: PushComposeCallback | BasePush,
  ): Promise<PushResponse[]> {
    if (typeof callbackOrPush !== "function") {
      this.sent.push(callbackOrPush);
    }
    return super.send(callbackOrPush);
  }

  override async sendCompiled(data: PushMessageData): Promise<PushResponse[]> {
    this.sentMessages.push(data);
    // Skip resolveRecipients for user-kind — fake just records, doesn't fan out.
    const resolved: ResolvedRecipient[] = data.recipients.flatMap((r) =>
      r.kind === "token"
        ? [{ kind: "token", token: r.token, platform: r.platform }]
        : [],
    );
    return Promise.all(
      resolved.map(async (recipient) => fakeTransport.send(data, recipient)),
    );
  }

  clear(): void {
    this.sent.length = 0;
    this.sentMessages.length = 0;
  }

  assertSent<T extends new (...args: never[]) => BasePush>(
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

  assertNotSent<T extends new (...args: never[]) => BasePush>(
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
    cls: new (...args: never[]) => BasePush,
    count: number,
  ): this;
  assertSentCount(
    clsOrCount: (new (...args: never[]) => BasePush) | number,
    count?: number,
  ): this {
    if (typeof clsOrCount === "number") {
      if (this.sent.length !== clsOrCount) {
        throw new Error(
          `Expected ${clsOrCount} pushes sent, got ${this.sent.length}`,
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
      throw new Error(`Expected no pushes sent, got: ${names}`);
    }
    return this;
  }

  /** Assert that at least one push went to a token (or userId) matching the needle. */
  assertSentTo(needle: string): this {
    const match = this.sentMessages.find((m) =>
      m.recipients.some((r) => tokenMatches(r, needle)),
    );
    if (!match) {
      throw new Error(`Expected a push sent to "${needle.slice(0, 16)}…"`);
    }
    return this;
  }
}
