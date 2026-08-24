// Public API of @saas/notifications.
// See .claude/skills/notifications/SKILL.md for the full handbook.

export { Notification, type NotificationRenderers } from "./notification";
export { Notifier, type NotifierConfig } from "./notifier";
export { FakeNotifier } from "./fake-notifier";

export type { NotificationChannel, ChannelRegistry } from "./channels/channel";
export { MailChannel, type MailGateway, type MailBuilder } from "./channels/mail";
export { SmsChannel, type SmsGateway, type SmsBuilder } from "./channels/sms";
export { PushChannel, type PushGateway, type PushBuilder } from "./channels/push";
export {
  WhatsAppChannel,
  type WhatsAppGateway,
  type WhatsAppBuilder,
} from "./channels/whatsapp";
export {
  RealtimeChannel,
  type RealtimeGateway,
} from "./channels/realtime";
export {
  DatabaseChannel,
  type DatabaseNotificationRepository,
  type DatabaseNotificationInput,
  type AdminDatabaseNotificationRepository,
  type AdminDatabaseNotificationInput,
} from "./channels/database";

export {
  BaseChannelMessage,
  type ChannelReturn,
  isChannelMessage,
  normalizeContract,
} from "./messages/base-channel-message";
export type {
  ChannelContractMap,
  DatabaseContract,
  MailContract,
  PushContract,
  RealtimeContract,
  SmsContract,
  WhatsAppContract,
} from "./messages/contracts";

export type { NotifiableRepository } from "./notifiable";
export { isFullyResolved } from "./notifiable";
export type { PreferencesRepository } from "./preferences";
export { resolveChannels } from "./preferences";

export {
  isOptOutable,
  isUserNotifiable,
  OPT_OUTABLE_CATEGORIES,
  recipientId,
  type BuiltInChannelName,
  type ChannelName,
  type ChannelResult,
  type CustomerNotifiable,
  type Notifiable,
  type NotifiableInput,
  type NotificationCategory,
  type NotifierLogLevel,
  type NotifierLogger,
  type ResolvedCustomerNotifiable,
  type ResolvedNotifiable,
  type ResolvedUserNotifiable,
  type SendOptions,
  type SendResult,
  type SkipReason,
  type UserNotifiable,
} from "./types";
