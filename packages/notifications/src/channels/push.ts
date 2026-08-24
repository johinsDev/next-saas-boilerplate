import { normalizeContract } from "../messages/base-channel-message";
import type { PushContract } from "../messages/contracts";
import type { Notification, NotificationRenderers } from "../notification";
import type { ChannelResult, ResolvedNotifiable } from "../types";
import type { NotificationChannel } from "./channel";

/** Fluent slice of `PushMessage` the push channel drives. */
export interface PushBuilder {
  toUser(userId: string): unknown;
  title(text: string): unknown;
  body(text: string): unknown;
  data(payload: Record<string, unknown>): unknown;
  clickAction(url: string): unknown;
}

/** Structural slice of `@saas/push`'s `PushManager`. */
export interface PushGateway {
  send(callback: (m: PushBuilder) => void | Promise<void>): Promise<unknown>;
}

/**
 * Adapts `Notification.toPush()` to an injected push manager. Token
 * resolution stays in the manager (its `tokenLookup`); the channel only
 * addresses the recipient by customer id. Web-only for now.
 */
export class PushChannel implements NotificationChannel {
  readonly name = "push";
  readonly method = "toPush" as const;

  constructor(private readonly push: PushGateway) {}

  async send(
    notification: Notification,
    notifiable: ResolvedNotifiable,
  ): Promise<ChannelResult> {
    const render = notification as NotificationRenderers;
    if (!render.toPush) {
      return { channel: this.name, status: "skipped", reason: "no-method" };
    }
    // Push tokens are registered by the customer PWA only — a staff user has
    // no device to address, so skip rather than send into the void.
    if (notifiable.kind === "user") {
      return { channel: this.name, status: "skipped", reason: "not-registered" };
    }
    const contract = await normalizeContract<PushContract>(
      await render.toPush(notifiable),
    );
    const response = await this.push.send((m) => {
      m.toUser(notifiable.customerId);
      m.title(contract.title);
      m.body(contract.body);
      if (contract.data) m.data(contract.data);
      if (contract.clickAction) m.clickAction(contract.clickAction);
    });
    return { channel: this.name, status: "sent", response };
  }
}
