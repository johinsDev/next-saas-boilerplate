import type { WhatsAppMessage } from "./whatsapp-message";

/**
 * Wire payload that every transport receives. Buildable via the
 * fluent `WhatsAppMessage` builder or composed by hand.
 */
export interface WhatsAppMessageData {
  to: string;
  from?: string;
  content: string;
  mediaUrl?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}

/**
 * What a transport returns after a successful (or queued) send.
 * `failed` is reserved for transports that surface failure synchronously
 * — most throw a `ProviderError` instead.
 */
export interface WhatsAppResponse {
  status: "sent" | "queued" | "failed";
  providerMessageId?: string;
  provider: string;
  timestamp: string;
}

/**
 * Interface every WhatsApp strategy implements. Mirrors `LogTransport`
 * from `@saas/log` — `name` shows up in logs and test failures,
 * `send` does the work.
 */
export interface WhatsAppTransport {
  readonly name: string;
  send(message: WhatsAppMessageData): Promise<WhatsAppResponse>;
}

export interface TwilioWhatsAppProviderConfig {
  provider: "twilio";
  accountSid: string;
  authToken: string;
  from: string;
  /** Skip the 2s post-send delivery check (useful in unit tests). */
  skipVerify?: boolean;
}

export interface LogProviderConfig {
  provider: "log";
  /**
   * Pre-built `Logger` from `@saas/log` to write structured send
   * records to. Pass the app's bootstrapped logger here.
   */
  logger: WhatsAppLogger;
}

export interface FolderProviderConfig {
  provider: "folder";
  /** Defaults to `.whatsapp-previews/` next to `process.cwd()`. */
  outputDir?: string;
  /** Open the rendered HTML in the browser on each send. Default false. */
  openInBrowser?: boolean;
}

export interface OutboxProviderConfig {
  provider: "outbox";
  /** Drizzle `db` instance injected by the bootstrap module. */
  db: WhatsAppOutboxDb;
}

export type ProviderConfig =
  | TwilioWhatsAppProviderConfig
  | LogProviderConfig
  | FolderProviderConfig
  | OutboxProviderConfig;

/**
 * Structural type of the slice of `@saas/log`'s `Logger` we use.
 * Kept narrow so swapping loggers (or fakes) doesn't drag the whole
 * package surface.
 */
export interface WhatsAppLogger {
  info(bindings: Record<string, unknown>, msg?: string): void;
  warn(bindings: Record<string, unknown>, msg?: string): void;
  error(bindings: Record<string, unknown>, msg?: string): void;
}

/**
 * Structural type of the Drizzle `db` slice the outbox transport
 * needs. Kept very loose so the real Drizzle `db` (which has
 * generated table types) is assignable; the transport accesses
 * `id` defensively at runtime.
 */
export interface WhatsAppOutboxDb {
  // biome-ignore lint/suspicious/noExplicitAny: structural shim for Drizzle's builder
  insert: (table: any) => any;
}

export type WhatsAppLogLevel = "debug" | "info" | "silent";

export interface WhatsAppManagerConfig<
  T extends Record<string, ProviderConfig | undefined>,
> {
  default: keyof T & string;
  mailers: T;
  /** Defaults to `info`. `silent` suppresses internal `[whatsapp]` lines. */
  logLevel?: WhatsAppLogLevel;
}

/** Inline-compose helper signature for `manager.send((m) => ...)`. */
export type WhatsAppComposeCallback = (
  message: WhatsAppMessage,
) => void | Promise<void>;

/**
 * Stored shape for folder / outbox previews. JSON exported from the
 * folder transport mirrors this; the outbox row contains the same
 * columns flattened (see `packages/db/src/schema/whatsapp-outbox.ts`).
 */
export interface WhatsAppPreview {
  id: string;
  message: WhatsAppMessageData;
  response: WhatsAppResponse;
  sentAt: string;
}
