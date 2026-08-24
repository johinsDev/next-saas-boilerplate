// Public API of @saas/sms.
// See .claude/skills/sms/SKILL.md for the full handbook.

export { BaseSms } from "./base-sms";
export {
  InvalidMessageError,
  InvalidPhoneNumberError,
  ProviderError,
  RateLimitError,
  SmsError,
} from "./errors";
export { fakeMessage, fakeResponse } from "./factories";
export { FakeSender } from "./fake-sender";
export { SmsManager } from "./manager";
export {
  e164PhoneSchema,
  isGsm7,
  smsContentSchema,
  smsSegmentInfo,
  type SegmentInfo,
} from "./schemas";
export { SmsSender } from "./sender";
export { SmsMessage } from "./sms-message";
export type {
  FolderProviderConfig,
  LogProviderConfig,
  OutboxProviderConfig,
  ProviderConfig,
  SmsComposeCallback,
  SmsLogger,
  SmsLogLevel,
  SmsManagerConfig,
  SmsMessageData,
  SmsOutboxDb,
  SmsPreview,
  SmsResponse,
  SmsTransport,
  TwilioSmsProviderConfig,
} from "./types";
