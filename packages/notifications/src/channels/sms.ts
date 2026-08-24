import { normalizeContract } from "../messages/base-channel-message";
import type { SmsContract } from "../messages/contracts";
import type { Notification, NotificationRenderers } from "../notification";
import type { ChannelResult, ResolvedNotifiable } from "../types";
import type { NotificationChannel } from "./channel";

/** Fluent slice of `SmsMessage` the sms channel drives. */
export interface SmsBuilder {
  to(phone: string): unknown;
  content(text: string): unknown;
}

/** Structural slice of `@saas/sms`'s `SmsManager`. */
export interface SmsGateway {
  send(callback: (m: SmsBuilder) => void | Promise<void>): Promise<unknown>;
}

/** Adapts `Notification.toSms()` to an injected sms manager. */
export class SmsChannel implements NotificationChannel {
  readonly name = "sms";
  readonly method = "toSms" as const;

  constructor(private readonly sms: SmsGateway) {}

  async send(
    notification: Notification,
    notifiable: ResolvedNotifiable,
  ): Promise<ChannelResult> {
    const render = notification as NotificationRenderers;
    if (!render.toSms) {
      return { channel: this.name, status: "skipped", reason: "no-method" };
    }
    const contract = await normalizeContract<SmsContract>(
      await render.toSms(notifiable),
    );
    const to = contract.to ?? notifiable.phone;
    if (!to) {
      return { channel: this.name, status: "skipped", reason: "no-contact" };
    }
    const response = await this.sms.send((m) => {
      m.to(to);
      m.content(contract.body);
    });
    return { channel: this.name, status: "sent", response };
  }
}
