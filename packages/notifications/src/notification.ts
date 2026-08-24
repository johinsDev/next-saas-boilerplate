import type {
  DatabaseContract,
  MailContract,
  PushContract,
  RealtimeContract,
  SmsContract,
  WhatsAppContract,
} from "./messages/contracts";
import type { ChannelReturn } from "./messages/base-channel-message";
import type { ChannelName, Notifiable, NotificationCategory } from "./types";

/**
 * Optional per-channel renderers. Kept as a standalone interface (rather than
 * members on the base class) so subclasses can implement them with a plain
 * method — no `override` keyword. Add `implements NotificationRenderers` to a
 * notification to type-check the return shapes:
 *
 *   class NewUserNotification extends Notification implements NotificationRenderers { … }
 *
 * A channel declared in `via()` but missing its `toX()` is reported
 * `skipped / no-method`, so notifications may declare a superset and
 * implement selectively.
 */
export interface NotificationRenderers {
  toMail?(
    notifiable: Notifiable,
  ): ChannelReturn<MailContract> | Promise<ChannelReturn<MailContract>>;

  toSms?(
    notifiable: Notifiable,
  ): ChannelReturn<SmsContract> | Promise<ChannelReturn<SmsContract>>;

  toPush?(
    notifiable: Notifiable,
  ): ChannelReturn<PushContract> | Promise<ChannelReturn<PushContract>>;

  toWhatsApp?(
    notifiable: Notifiable,
  ): ChannelReturn<WhatsAppContract> | Promise<ChannelReturn<WhatsAppContract>>;

  toRealtime?(
    notifiable: Notifiable,
  ): ChannelReturn<RealtimeContract> | Promise<ChannelReturn<RealtimeContract>>;

  toDatabase?(
    notifiable: Notifiable,
  ): ChannelReturn<DatabaseContract> | Promise<ChannelReturn<DatabaseContract>>;
}

/**
 * Base class for a notification — Laravel/Adonis style, adapted to our
 * Drizzle/no-model stack. Subclass per use-case (`NewUserNotification`,
 * `PromoNotification`, …):
 *
 *   1. set `category` (drives opt-out: only `marketing` is suppressible);
 *   2. declare `via(notifiable)` → the channels to attempt;
 *   3. implement the matching `toX()` renderers. Each returns the channel's
 *      contract (plain object or a `BaseChannelMessage` instance).
 *
 * @example
 *   class NewUserNotification extends Notification {
 *     readonly category = "transactional";
 *     constructor(private readonly name: string) { super(); }
 *     via() { return ["mail", "database", "push"]; }
 *     toMail() { return { subject: "Welcome", html: `<p>Hi ${this.name}</p>` }; }
 *     toDatabase() { return { type: "welcome", title: "Welcome", body: "Glad you're here" }; }
 *     toPush() { return { title: "Welcome", body: `Hi ${this.name}` }; }
 *   }
 */
export abstract class Notification {
  /** Drives opt-out. `marketing` = suppressible; anything else = mandatory. */
  abstract readonly category: NotificationCategory;

  /** Channels to attempt for this recipient. May branch on the notifiable. */
  abstract via(
    notifiable: Notifiable,
  ): ChannelName[] | readonly ChannelName[] | Promise<ChannelName[]>;
}
