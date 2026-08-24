import type { Notification } from "./notification";
import type {
  ChannelName,
  ChannelResult,
  NotifiableInput,
  SendOptions,
  SendResult,
} from "./types";
import { recipientId } from "./types";

interface RecordedNotification {
  notification: Notification;
  recipient: { kind: "customer" | "user"; id: string };
  organizationId: string;
  channels: ChannelName[];
}

type NotificationClass<T extends Notification> = new (
  ...args: never[]
) => T;

/**
 * In-memory notifier for tests. Captures the notification + its declared
 * channels (from `via()`) without touching any transport. Activated via
 * `notifier.fake()`.
 *
 * @example
 *   const fake = notifier.fake();
 *   await runFlowThatNotifiesNewUser();
 *   fake.assertSent(NewUserNotification);
 *   fake.assertSentOnChannel(NewUserNotification, "mail");
 *   notifier.restore();
 */
export class FakeNotifier {
  readonly sent: RecordedNotification[] = [];

  async send(
    target: NotifiableInput,
    notification: Notification,
    opts?: SendOptions,
  ): Promise<SendResult> {
    let channels = [...(await notification.via(target))];
    if (opts?.onlyChannels) {
      const allow = new Set(opts.onlyChannels);
      channels = channels.filter((c) => allow.has(c));
    }
    const recipient = {
      kind: target.kind === "user" ? ("user" as const) : ("customer" as const),
      id: recipientId(target),
    };
    this.sent.push({
      notification,
      recipient,
      organizationId: target.organizationId,
      channels,
    });
    const results: ChannelResult[] = channels.map((channel) => ({
      channel,
      status: "sent",
    }));
    return {
      notification: notification.constructor.name,
      recipient,
      category: notification.category,
      results,
      ok: true,
    };
  }

  clear(): void {
    this.sent.length = 0;
  }

  assertSent<T extends Notification>(
    cls: NotificationClass<T>,
    findFn?: (n: T) => boolean,
  ): this {
    const match = this.#find(cls, findFn);
    if (!match) throw new Error(`Expected "${cls.name}" to have been sent`);
    return this;
  }

  assertNotSent<T extends Notification>(
    cls: NotificationClass<T>,
    findFn?: (n: T) => boolean,
  ): this {
    const match = this.#find(cls, findFn);
    if (match) throw new Error(`Unexpected "${cls.name}" was sent`);
    return this;
  }

  assertSentOnChannel<T extends Notification>(
    cls: NotificationClass<T>,
    channel: ChannelName,
  ): this {
    const match = this.sent.find(
      (r) => r.notification instanceof cls && r.channels.includes(channel),
    );
    if (!match) {
      throw new Error(
        `Expected "${cls.name}" to have been sent on channel "${channel}"`,
      );
    }
    return this;
  }

  assertSentCount(count: number): this;
  assertSentCount(cls: NotificationClass<Notification>, count: number): this;
  assertSentCount(
    clsOrCount: NotificationClass<Notification> | number,
    count?: number,
  ): this {
    if (typeof clsOrCount === "number") {
      if (this.sent.length !== clsOrCount) {
        throw new Error(
          `Expected ${clsOrCount} notifications sent, got ${this.sent.length}`,
        );
      }
      return this;
    }
    const actual = this.sent.filter(
      (r) => r.notification instanceof clsOrCount,
    ).length;
    if (actual !== count) {
      throw new Error(
        `Expected "${clsOrCount.name}" sent ${count} times, got ${actual}`,
      );
    }
    return this;
  }

  assertNoneSent(): this {
    if (this.sent.length > 0) {
      const names = this.sent
        .map((r) => r.notification.constructor.name)
        .join(", ");
      throw new Error(`Expected no notifications sent, got: ${names}`);
    }
    return this;
  }

  #find<T extends Notification>(
    cls: NotificationClass<T>,
    findFn?: (n: T) => boolean,
  ): RecordedNotification | undefined {
    return this.sent.find((r) => {
      if (!(r.notification instanceof cls)) return false;
      return findFn ? findFn(r.notification as T) : true;
    });
  }
}
