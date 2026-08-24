/**
 * Wire-neutral per-channel message contracts. A notification's `toX()`
 * returns one of these (or a `BaseChannelMessage` wrapping one); the matching
 * channel adapter maps it onto the injected transport's builder. Authors never
 * touch the underlying `@saas/*` builders directly.
 */

export interface MailContract {
  subject: string;
  html: string;
  text?: string;
  /** Override recipient; defaults to the notifiable's email. */
  to?: string;
  replyTo?: string;
}

export interface SmsContract {
  body: string;
  /** Override recipient; defaults to the notifiable's phone. */
  to?: string;
}

export interface PushContract {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  clickAction?: string;
  /** Recipient is always the notifiable's customer; tokens resolved by the push manager. */
}

export interface WhatsAppContract {
  /** Override recipient; defaults to the notifiable's phone. */
  to?: string;
  /** Freeform body (session message). Ignored when `template` is set. */
  body?: string;
  /** Approved template send (Twilio content SID + variables). */
  template?: { sid: string; variables?: Record<string, string> };
}

export interface RealtimeContract {
  event: string;
  data: Record<string, unknown>;
  /** Defaults to `customer:<customerId>`. */
  room?: `customer:${string}` | `org:${string}`;
}

export interface DatabaseContract {
  /** Type discriminator the in-app feed renders against. */
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  // ── Admin inbox only (ignored when the recipient is a customer) ──
  /** Row tone in the admin inbox. Defaults to `info`. */
  severity?: string;
  /** Deep-link target for the detail panel. */
  entityType?: string;
  entityId?: string;
  /** Overrides the recipient's store scope for this alert. */
  storeId?: string | null;
}

/** Maps a built-in channel key to its contract. Used for generic typing. */
export interface ChannelContractMap {
  mail: MailContract;
  sms: SmsContract;
  push: PushContract;
  whatsapp: WhatsAppContract;
  realtime: RealtimeContract;
  database: DatabaseContract;
}
