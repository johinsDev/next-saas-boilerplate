import { normalizeContract } from "../messages/base-channel-message";
import type { WhatsAppContract } from "../messages/contracts";
import type { Notification, NotificationRenderers } from "../notification";
import type { ChannelResult, ResolvedNotifiable } from "../types";
import type { NotificationChannel } from "./channel";

/** Fluent slice of `WhatsAppMessage` the channel drives. */
export interface WhatsAppBuilder {
  to(phone: string): unknown;
  content(text: string): unknown;
  template(sid: string, variables?: Record<string, string>): unknown;
}

/** Structural slice of `@saas/whatsapp`'s `WhatsAppManager`. */
export interface WhatsAppGateway {
  send(
    callback: (m: WhatsAppBuilder) => void | Promise<void>,
  ): Promise<unknown>;
}

/** Adapts `Notification.toWhatsApp()` to an injected WhatsApp manager. */
export class WhatsAppChannel implements NotificationChannel {
  readonly name = "whatsapp";
  readonly method = "toWhatsApp" as const;

  constructor(private readonly whatsapp: WhatsAppGateway) {}

  async send(
    notification: Notification,
    notifiable: ResolvedNotifiable,
  ): Promise<ChannelResult> {
    const render = notification as NotificationRenderers;
    if (!render.toWhatsApp) {
      return { channel: this.name, status: "skipped", reason: "no-method" };
    }
    const contract = await normalizeContract<WhatsAppContract>(
      await render.toWhatsApp(notifiable),
    );
    const to = contract.to ?? notifiable.phone;
    if (!to) {
      return { channel: this.name, status: "skipped", reason: "no-contact" };
    }
    if (!contract.template && !contract.body) {
      return { channel: this.name, status: "skipped", reason: "no-method" };
    }
    const response = await this.whatsapp.send((m) => {
      m.to(to);
      if (contract.template) {
        m.template(contract.template.sid, contract.template.variables);
      } else if (contract.body) {
        m.content(contract.body);
      }
    });
    return { channel: this.name, status: "sent", response };
  }
}
