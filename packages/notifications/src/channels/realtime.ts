import { normalizeContract } from "../messages/base-channel-message";
import type { RealtimeContract } from "../messages/contracts";
import type { Notification, NotificationRenderers } from "../notification";
import type { ChannelResult, ResolvedNotifiable } from "../types";
import type { NotificationChannel } from "./channel";

/**
 * Structural slice of `@saas/realtime`'s `RealtimeClient.publish`. Both the
 * real client and `FakeRealtime` satisfy this.
 */
export interface RealtimeGateway {
  publish(
    room: `customer:${string}` | `org:${string}`,
    event: { event: string; data: Record<string, unknown> },
  ): Promise<void>;
}

/**
 * Adapts `Notification.toRealtime()` to an injected realtime publisher.
 * Defaults the room to `customer:<customerId>`.
 */
export class RealtimeChannel implements NotificationChannel {
  readonly name = "realtime";
  readonly method = "toRealtime" as const;

  constructor(private readonly realtime: RealtimeGateway) {}

  async send(
    notification: Notification,
    notifiable: ResolvedNotifiable,
  ): Promise<ChannelResult> {
    const render = notification as NotificationRenderers;
    if (!render.toRealtime) {
      return { channel: this.name, status: "skipped", reason: "no-method" };
    }
    const contract = await normalizeContract<RealtimeContract>(
      await render.toRealtime(notifiable),
    );
    // Only a customer has an implicit room. A staff recipient must name one
    // explicitly — admin alerts publish a single org-wide signal from the job
    // instead of one frame per recipient, so there is no default here.
    const room =
      contract.room ??
      (notifiable.kind === "user" ? null : `customer:${notifiable.customerId}`);
    if (!room) {
      return { channel: this.name, status: "skipped", reason: "no-method" };
    }
    await this.realtime.publish(room, {
      event: contract.event,
      data: contract.data,
    });
    return { channel: this.name, status: "sent", response: { room } };
  }
}
