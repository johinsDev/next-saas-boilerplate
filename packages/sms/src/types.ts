import type { SmsMessage } from "./sms-message";

/**
 * Wire payload that every transport receives. Buildable via the
 * fluent `SmsMessage` builder or composed by hand.
 */
export interface SmsMessageData {
  to: string;
  from?: string;
  content: string;
}

/**
 * What a transport returns after a successful (or queued) send.
 * `failed` is reserved for transports that surface failure synchronously
 * — most throw a `ProviderError` instead.
 */
export interface SmsResponse {
  status: "sent" | "queued" | "failed";
  providerMessageId?: string;
  provider: string;
  timestamp: string;
  /** Segment info for cost / encoding-debug surfaces. Optional. */
  segments?: {
    encoding: "GSM-7" | "UCS-2";
    characters: number;
    count: number;
  };
}

/**
 * Interface every SMS strategy implements.
 */
export interface SmsTransport {
  readonly name: string;
  send(message: SmsMessageData): Promise<SmsResponse>;
}

export interface TwilioSmsProviderConfig {
  provider: "twilio";
  accountSid: string;
  authToken: string;
  /** E.164 sender (long code, short code, or Messaging Service SID-mapped). */
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
  logger: SmsLogger;
}

export interface FolderProviderConfig {
  provider: "folder";
  /** Defaults to `.sms-previews/` next to `process.cwd()`. */
  outputDir?: string;
  /** Open the rendered HTML in the browser on each send. Default false. */
  openInBrowser?: boolean;
}

export interface OutboxProviderConfig {
  provider: "outbox";
  /** Drizzle `db` instance injected by the bootstrap module. */
  db: SmsOutboxDb;
}

export type ProviderConfig =
  | TwilioSmsProviderConfig
  | LogProviderConfig
  | FolderProviderConfig
  | OutboxProviderConfig;

/**
 * Structural type of the slice of `@saas/log`'s `Logger` we use.
 * Kept narrow so swapping loggers (or fakes) doesn't drag the whole
 * package surface.
 */
export interface SmsLogger {
  info(bindings: Record<string, unknown>, msg?: string): void;
  warn(bindings: Record<string, unknown>, msg?: string): void;
  error(bindings: Record<string, unknown>, msg?: string): void;
}

/**
 * Structural type of the Drizzle `db` slice the outbox transport
 * needs. Kept very loose so the real Drizzle `db` (which has
 * generated table types) is assignable.
 */
export interface SmsOutboxDb {
  // biome-ignore lint/suspicious/noExplicitAny: structural shim for Drizzle's builder
  insert: (table: any) => any;
}

export type SmsLogLevel = "debug" | "info" | "silent";

export interface SmsManagerConfig<
  T extends Record<string, ProviderConfig | undefined>,
> {
  default: keyof T & string;
  mailers: T;
  /** Defaults to `info`. `silent` suppresses internal `[sms]` lines. */
  logLevel?: SmsLogLevel;
}

/** Inline-compose helper signature for `manager.send((m) => ...)`. */
export type SmsComposeCallback = (
  message: SmsMessage,
) => void | Promise<void>;

/**
 * Stored shape for folder / outbox previews. JSON exported from the
 * folder transport mirrors this; the outbox row contains the same
 * columns flattened (see `packages/db/src/schema/sms-outbox.ts`).
 */
export interface SmsPreview {
  id: string;
  message: SmsMessageData;
  response: SmsResponse;
  segments: {
    encoding: "GSM-7" | "UCS-2";
    characters: number;
    count: number;
  };
  sentAt: string;
}
