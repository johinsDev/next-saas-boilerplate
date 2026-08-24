// Public API of @saas/email.
// See .claude/skills/email/SKILL.md for the full handbook.

export { BaseEmail } from "./base-email";
export { EmailMessage } from "./email-message";
export { EmailManager } from "./manager";
export { EmailSender } from "./sender";
export { FakeSender } from "./fake-sender";
export {
  EmailError,
  InvalidEmailError,
  InvalidMessageError,
  MissingDependencyError,
  ProviderError,
  RateLimitError,
} from "./errors";
export { fakeMessage, fakeResponse } from "./factories";
export {
  emailAddressSchema,
  emailContentSchema,
  emailSubjectSchema,
  priorityToXPriority,
  type EmailPriorityLevel,
} from "./schemas";
export type {
  EmailAttachment,
  EmailComposeCallback,
  EmailLogger,
  EmailLogLevel,
  EmailManagerConfig,
  EmailMessageData,
  EmailOutboxDb,
  EmailPreview,
  EmailResponse,
  EmailTag,
  EmailTransport,
  FolderProviderConfig,
  LogProviderConfig,
  OutboxProviderConfig,
  ProviderConfig,
  Recipient,
  ResendProviderConfig,
} from "./types";
