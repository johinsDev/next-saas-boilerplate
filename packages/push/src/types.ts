import type { PushMessage } from "./push-message";
import type { PushPlatform, PushPriorityLevel } from "./schemas";

/**
 * Recipient pre-resolution. Either a specific device token + platform,
 * or a `userId` that the sender resolves via `tokenLookup` to N device
 * tokens at send time.
 */
export type PushRecipient =
  | { kind: "token"; token: string; platform: PushPlatform }
  | { kind: "user"; userId: string };

/**
 * What a transport actually sees — a single device. The fan-out from
 * user → multiple devices lives in the sender, not the transport.
 */
export type ResolvedRecipient = {
  kind: "token";
  token: string;
  platform: PushPlatform;
};

/**
 * Compiled wire payload. The `recipients` field is pre-resolution; the
 * sender resolves it before invoking the transport (which only ever
 * sees `ResolvedRecipient`).
 */
export interface PushMessageData {
  recipients: PushRecipient[];
  title: string;
  body: string;
  /** Arbitrary key/value pairs delivered alongside the visible push (deep link IDs, etc). */
  data?: Record<string, unknown>;
  badge?: number;
  icon?: string;
  image?: string;
  sound?: string;
  /** URL to focus / open when the user taps the notification (web push). */
  clickAction?: string;
  /** Seconds; transports honor this where supported (web push + expo). */
  ttl?: number;
  priority?: PushPriorityLevel;
}

/**
 * What a transport returns after a successful (or queued) send to one
 * device. Multi-recipient messages produce one response per recipient.
 *
 * `status: "expired"` is the auto sender's normalized result for
 * `SubscriptionExpiredError`; transports themselves throw instead.
 */
export interface PushResponse {
  status: "sent" | "queued" | "failed" | "expired";
  providerMessageId?: string;
  provider: string;
  platform: PushPlatform;
  token: string;
  timestamp: string;
  error?: string;
}

export interface PushTransport {
  readonly name: string;
  /** Send to a single resolved device. */
  send(
    message: PushMessageData,
    recipient: ResolvedRecipient,
  ): Promise<PushResponse>;
}

export interface WebPushProviderConfig {
  provider: "webpush";
  publicKey: string;
  privateKey: string;
  /** Contact URI for push service operators, typically `mailto:...`. */
  subject: string;
}

export interface ExpoProviderConfig {
  provider: "expo";
  /**
   * Optional Expo access token for enhanced security. When set, all
   * requests to Expo's push API are authenticated.
   */
  accessToken?: string;
}

export interface LogProviderConfig {
  provider: "log";
  logger: PushLogger;
}

export interface OutboxProviderConfig {
  provider: "outbox";
  /** Drizzle `db` instance injected by the bootstrap module. */
  db: PushOutboxDb;
}

/**
 * Fan-out sender that owns both production transports plus the
 * customer → tokens lookup. The default in production env.
 */
export interface AutoProviderConfig {
  provider: "auto";
  webpush: WebPushProviderConfig;
  expo: ExpoProviderConfig;
  tokenLookup: PushTokenLookup;
}

export type ProviderConfig =
  | WebPushProviderConfig
  | ExpoProviderConfig
  | LogProviderConfig
  | OutboxProviderConfig
  | AutoProviderConfig;

/**
 * Look up a user's active push tokens — called by the `auto` sender
 * (and by any other sender constructed with `tokenLookup`) when a
 * recipient is `{ kind: "user", userId }`.
 */
export type PushTokenLookup = (
  userId: string,
) => Promise<Array<{ token: string; platform: PushPlatform }>>;

/**
 * Structural type of the slice of `@saas/log`'s `Logger` we use.
 * Kept narrow so swapping loggers (or fakes) doesn't drag the whole
 * package surface.
 */
export interface PushLogger {
  info(bindings: Record<string, unknown>, msg?: string): void;
  warn(bindings: Record<string, unknown>, msg?: string): void;
  error(bindings: Record<string, unknown>, msg?: string): void;
}

/**
 * Structural type of the Drizzle `db` slice the outbox transport
 * needs. Kept very loose so the real Drizzle `db` is assignable.
 */
export interface PushOutboxDb {
  // biome-ignore lint/suspicious/noExplicitAny: structural shim for Drizzle's builder
  insert: (table: any) => any;
}

export type PushLogLevel = "debug" | "info" | "silent";

export interface PushManagerConfig<
  T extends Record<string, ProviderConfig | undefined>,
> {
  default: keyof T & string;
  senders: T;
  /** Defaults to `info`. `silent` suppresses internal `[push]` lines. */
  logLevel?: PushLogLevel;
  /**
   * Resolve a `userId` → device tokens, applied to EVERY sender (log,
   * outbox, webpush, expo). Without it, those senders throw on a
   * `toUser(...)` recipient — only the `auto` provider (which carries its
   * own `tokenLookup`) could resolve users. Set this once at the manager
   * level so `toUser(...)` works regardless of the active provider. The
   * `auto` provider's own `tokenLookup` takes precedence when present.
   */
  tokenLookup?: PushTokenLookup;
}

/** Inline-compose helper signature for `manager.send((m) => ...)`. */
export type PushComposeCallback = (
  message: PushMessage,
) => void | Promise<void>;
