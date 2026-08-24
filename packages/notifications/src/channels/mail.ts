import { normalizeContract } from "../messages/base-channel-message";
import type { MailContract } from "../messages/contracts";
import type { Notification, NotificationRenderers } from "../notification";
import type { ChannelResult, ResolvedNotifiable } from "../types";
import type { NotificationChannel } from "./channel";

/** Fluent slice of `EmailMessage` the mail channel drives. */
export interface MailBuilder {
  to(address: string, name?: string): unknown;
  subject(text: string): unknown;
  html(content: string): unknown;
  text(content: string): unknown;
  replyTo(address: string, name?: string): unknown;
}

/** Structural slice of `@saas/email`'s `EmailManager`. */
export interface MailGateway {
  send(callback: (m: MailBuilder) => void | Promise<void>): Promise<unknown>;
}

/** Adapts `Notification.toMail()` to an injected email manager. */
export class MailChannel implements NotificationChannel {
  readonly name = "mail";
  readonly method = "toMail" as const;

  constructor(private readonly mail: MailGateway) {}

  async send(
    notification: Notification,
    notifiable: ResolvedNotifiable,
  ): Promise<ChannelResult> {
    const render = notification as NotificationRenderers;
    if (!render.toMail) {
      return { channel: this.name, status: "skipped", reason: "no-method" };
    }
    const contract = await normalizeContract<MailContract>(
      await render.toMail(notifiable),
    );
    const to = contract.to ?? notifiable.email;
    if (!to) {
      return { channel: this.name, status: "skipped", reason: "no-contact" };
    }
    const response = await this.mail.send((m) => {
      m.to(to, notifiable.name ?? undefined);
      m.subject(contract.subject);
      m.html(contract.html);
      if (contract.text) m.text(contract.text);
      if (contract.replyTo) m.replyTo(contract.replyTo);
    });
    return { channel: this.name, status: "sent", response };
  }
}
