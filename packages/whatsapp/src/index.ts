// Public API of @saas/whatsapp.
// See .claude/skills/whatsapp/SKILL.md for the full handbook.

export { BaseWhatsApp } from "./base-whatsapp";
export {
  InvalidMessageError,
  InvalidPhoneNumberError,
  ProviderError,
  RateLimitError,
  WhatsAppError,
} from "./errors";
export { fakeMessage, fakeResponse } from "./factories";
export { FakeSender } from "./fake-sender";
export { WhatsAppManager } from "./manager";
export {
  bold,
  boldItalic,
  codeBlock,
  e164PhoneSchema,
  italic,
  mono,
  strike,
  whatsappContentSchema,
} from "./schemas";
export { WhatsAppSender } from "./sender";
export type {
  FolderProviderConfig,
  LogProviderConfig,
  OutboxProviderConfig,
  ProviderConfig,
  TwilioWhatsAppProviderConfig,
  WhatsAppComposeCallback,
  WhatsAppLogger,
  WhatsAppLogLevel,
  WhatsAppManagerConfig,
  WhatsAppMessageData,
  WhatsAppOutboxDb,
  WhatsAppPreview,
  WhatsAppResponse,
  WhatsAppTransport,
} from "./types";
export { WhatsAppMessage } from "./whatsapp-message";
