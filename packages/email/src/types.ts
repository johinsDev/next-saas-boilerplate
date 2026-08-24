import type { EmailMessage } from "./email-message";
import type { EmailPriorityLevel } from "./schemas";

/**
 * Recipient — bare address string or `{address, name?}` shape that
 * renders as `"Name <addr>"` on the wire. Transports normalize back to
 * strings; the builder accepts both forms for ergonomics.
 */
export type Recipient = string | { address: string; name?: string };

export interface EmailAttachment {
  filename: string;
  /** Either a Buffer or a base64 string. Transports choose how to ship. */
  content: Buffer | string;
  contentType?: string;
}

export interface EmailTag {
  name: string;
  value: string;
}

/**
 * Wire payload that every transport receives. Buildable via the
 * fluent `EmailMessage` builder or composed by hand.
 *
 * Either `html` or `text` (or both) must be set — the builder enforces
 * this at `toData()` time.
 */
export interface EmailMessageData {
  to: Recipient[];
  from?: Recipient;
  replyTo?: Recipient;
  cc?: Recipient[];
  bcc?: Recipient[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  tags?: EmailTag[];
  priority?: EmailPriorityLevel;
  attachments?: EmailAttachment[];
}

/**
 * What a transport returns after a successful (or queued) send.
 * `failed` is reserved for transports that surface failure synchronously
 * — most throw a `ProviderError` instead.
 */
export interface EmailResponse {
  status: "sent" | "queued" | "failed";
  providerMessageId?: string;
  provider: string;
  timestamp: string;
}

export interface EmailTransport {
  readonly name: string;
  send(message: EmailMessageData): Promise<EmailResponse>;
}

export interface ResendProviderConfig {
  provider: "resend";
  apiKey: string;
  /** Default sender if `EmailMessage.from()` wasn't called. */
  from?: Recipient;
}

export interface LogProviderConfig {
  provider: "log";
  /**
   * Pre-built `Logger` from `@saas/log` to write structured send
   * records to. Pass the app's bootstrapped logger here.
   */
  logger: EmailLogger;
}

export interface FolderProviderConfig {
  provider: "folder";
  /** Defaults to `.email-previews/` next to `process.cwd()`. */
  outputDir?: string;
  /** Open the rendered HTML in the browser on each send. Default false. */
  openInBrowser?: boolean;
}

export interface OutboxProviderConfig {
  provider: "outbox";
  /** Drizzle `db` instance injected by the bootstrap module. */
  db: EmailOutboxDb;
}

export type ProviderConfig =
  | ResendProviderConfig
  | LogProviderConfig
  | FolderProviderConfig
  | OutboxProviderConfig;

/**
 * Structural type of the slice of `@saas/log`'s `Logger` we use.
 * Kept narrow so swapping loggers (or fakes) doesn't drag the whole
 * package surface.
 */
export interface EmailLogger {
  info(bindings: Record<string, unknown>, msg?: string): void;
  warn(bindings: Record<string, unknown>, msg?: string): void;
  error(bindings: Record<string, unknown>, msg?: string): void;
}

/**
 * Structural type of the Drizzle `db` slice the outbox transport
 * needs. Kept very loose so the real Drizzle `db` (which has
 * generated table types) is assignable.
 */
export interface EmailOutboxDb {
  // biome-ignore lint/suspicious/noExplicitAny: structural shim for Drizzle's builder
  insert: (table: any) => any;
}

export type EmailLogLevel = "debug" | "info" | "silent";

export interface EmailManagerConfig<
  T extends Record<string, ProviderConfig | undefined>,
> {
  default: keyof T & string;
  mailers: T;
  /** Defaults to `info`. `silent` suppresses internal `[email]` lines. */
  logLevel?: EmailLogLevel;
}

/** Inline-compose helper signature for `manager.send((m) => ...)`. */
export type EmailComposeCallback = (
  message: EmailMessage,
) => void | Promise<void>;

/**
 * Stored shape for folder previews. JSON exported from the folder
 * transport mirrors this; the outbox row contains the same columns
 * flattened (see `packages/db/src/schema/email-outbox.ts`).
 */
export interface EmailPreview {
  id: string;
  message: EmailMessageData;
  response: EmailResponse;
  sentAt: string;
}
