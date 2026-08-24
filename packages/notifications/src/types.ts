/**
 * Core shared types for `@saas/notifications`.
 *
 * The engine sits one layer above the channel transports (`@saas/email`,
 * `/sms`, `/push`, `/whatsapp`, `/realtime`, plus the in-app `database`
 * channel). A single `Notification` fans out to many channels; each channel
 * delegates to an injected transport. See `.claude/skills/notifications/SKILL.md`.
 */

/** Built-in channel keys. */
export type BuiltInChannelName =
  | "mail"
  | "sms"
  | "push"
  | "whatsapp"
  | "realtime"
  | "database";

/**
 * A channel name is any registered key. Kept as a widened string so custom
 * channels need no edit to this union.
 */
export type ChannelName = BuiltInChannelName | (string & {});

/**
 * Categories gate opt-out. `marketing` is suppressible by customer
 * preference; everything else (transactional, otp, …) is mandatory and
 * always sends.
 */
export type NotificationCategory =
  | "marketing"
  | "transactional"
  | "otp"
  | (string & {});

/** Categories a customer is allowed to opt out of. */
export const OPT_OUTABLE_CATEGORIES: ReadonlySet<NotificationCategory> =
  new Set<NotificationCategory>(["marketing"]);

/** True when a category may be suppressed by a per-channel preference. */
export function isOptOutable(category: NotificationCategory): boolean {
  return OPT_OUTABLE_CATEGORIES.has(category);
}

/** Contact fields any recipient may carry. The repository fills the gaps. */
interface NotifiableContact {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}

/**
 * A person who receives notifications — the original (and by far most common)
 * recipient. `kind` is optional here so the thousands of existing
 * `{ customerId, organizationId }` literals keep compiling untouched.
 */
export interface CustomerNotifiable extends NotifiableContact {
  kind?: "customer";
  customerId: string;
  organizationId: string;
}

/**
 * A staff `user` (owner / manager / cashier) — the recipient of admin alerts.
 * `storeId` scopes the alert to a branch so the inbox can filter by the store
 * switcher; null means org-wide.
 */
export interface UserNotifiable extends NotifiableContact {
  kind: "user";
  userId: string;
  organizationId: string;
  storeId?: string | null;
}

/**
 * Caller-facing recipient. Either a fully described object or — when only an
 * id is known — the engine hydrates the rest via `NotifiableRepository`.
 * `organizationId` is required because both customers and staff are org-scoped.
 */
export type Notifiable = CustomerNotifiable | UserNotifiable;

/** Hydrated customer. `phone` is guaranteed (notnull on the `customer` table). */
export interface ResolvedCustomerNotifiable {
  kind: "customer";
  customerId: string;
  organizationId: string;
  phone: string;
  email: string | null;
  name: string | null;
}

/**
 * Hydrated staff user. Unlike a customer, **`phone` may be null** — an employee
 * signs in with email/magic-link and need never register one. Channels that
 * need it must skip with `no-contact` rather than assume.
 */
export interface ResolvedUserNotifiable {
  kind: "user";
  userId: string;
  organizationId: string;
  storeId: string | null;
  phone: string | null;
  email: string | null;
  name: string | null;
}

/** Fully hydrated recipient the channels read from. */
export type ResolvedNotifiable =
  | ResolvedCustomerNotifiable
  | ResolvedUserNotifiable;

/** Accepted `send()` targets. */
export type NotifiableInput = Notifiable;

/** True when the recipient is a staff user rather than a customer. */
export function isUserNotifiable(
  n: Notifiable,
): n is UserNotifiable;
export function isUserNotifiable(
  n: ResolvedNotifiable,
): n is ResolvedUserNotifiable;
export function isUserNotifiable(
  n: Notifiable | ResolvedNotifiable,
): boolean {
  return n.kind === "user";
}

/**
 * The recipient's primary id, whichever entity it is. Channels that address a
 * recipient by id (push tokens, realtime rooms) go through this instead of
 * reaching for `customerId`.
 */
export function recipientId(n: Notifiable | ResolvedNotifiable): string {
  return n.kind === "user" ? n.userId : n.customerId;
}

/** Why a channel did not send. */
export type SkipReason =
  | "opted-out"
  | "no-method"
  | "no-contact"
  | "not-registered";

/** Per-channel outcome. One channel failing never aborts the others. */
export interface ChannelResult {
  channel: ChannelName;
  status: "sent" | "skipped" | "failed";
  reason?: SkipReason;
  /** Whatever the underlying transport returned (EmailResponse, SmsResponse, …). */
  response?: unknown;
  error?: Error;
}

/** Per-send options for `notifier.send()`. */
export interface SendOptions {
  /**
   * Restrict delivery to this channel allowlist (intersected with the
   * notification's declared `via()`). Used by the automated-trigger config to
   * override a notification's channels per org.
   */
  onlyChannels?: ChannelName[];
}

/** Aggregate result of a single `notifier.send()`. */
export interface SendResult {
  /** The notification class name (e.g. `NewUserNotification`). */
  notification: string;
  /** Who it went to — a customer or a staff user. */
  recipient: { kind: "customer" | "user"; id: string };
  category: NotificationCategory;
  results: ChannelResult[];
  /** True when no channel failed (skips don't count as failures). */
  ok: boolean;
}

/**
 * Structural slice of `@saas/log`'s `Logger` the notifier writes to.
 * Kept narrow so swapping loggers (or fakes) doesn't widen the surface.
 */
export interface NotifierLogger {
  info(bindings: Record<string, unknown>, msg?: string): void;
  warn(bindings: Record<string, unknown>, msg?: string): void;
  error(bindings: Record<string, unknown>, msg?: string): void;
}

export type NotifierLogLevel = "debug" | "info" | "silent";
