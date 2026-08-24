import {
  MissingDependencyError,
  ProviderError,
  RateLimitError,
  SubscriptionExpiredError,
} from "../errors";
import { webPushSubscriptionSchema } from "../schemas";
import { dynamicImport } from "./_lazy";
import type {
  PushMessageData,
  PushResponse,
  PushTransport,
  ResolvedRecipient,
  WebPushProviderConfig,
} from "../types";

function asMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Browser-PWA production transport. Sends via the standard Web Push
 * Protocol using VAPID authentication. The browser's push service
 * (FCM, Mozilla, etc) actually delivers the message.
 *
 * Lazy-loads the `web-push` SDK on first send so the package can be
 * imported (e.g. by tests using log/outbox transports) without
 * `web-push` installed.
 *
 * Maps:
 *   - HTTP 410 / 404 → `SubscriptionExpiredError` (caller deactivates the token)
 *   - HTTP 429 → `RateLimitError`
 *   - Other errors → `ProviderError`
 */
export class WebPushTransport implements PushTransport {
  readonly name = "webpush";
  readonly #config: WebPushProviderConfig;
  #initialized = false;
  #lib: WebPushLike | undefined;

  constructor(config: WebPushProviderConfig) {
    this.#config = config;
  }

  async #getLib(): Promise<WebPushLike> {
    if (this.#initialized && this.#lib) return this.#lib;
    let mod: unknown;
    try {
      // Function-constructor indirection hides the optional peer dep
      // from Turbopack / Webpack static analysis. Plain `await import("…")`
      // (and even `const name = "…"; await import(name)`) get traced
      // because the bundler does constant propagation. Building the
      // import body via `new Function` blocks that propagation entirely,
      // so the dev server stops emitting "Module not found" warnings
      // for providers the runtime never selects.
      mod = await dynamicImport("web-push");
    } catch {
      throw new MissingDependencyError("webpush", "web-push");
    }
    const maybeDefault = (mod as { default?: WebPushLike }).default;
    const lib = (maybeDefault ?? (mod as WebPushLike));
    lib.setVapidDetails(
      this.#config.subject,
      this.#config.publicKey,
      this.#config.privateKey,
    );
    this.#lib = lib;
    this.#initialized = true;
    return lib;
  }

  async send(
    message: PushMessageData,
    recipient: ResolvedRecipient,
  ): Promise<PushResponse> {
    const lib = await this.#getLib();

    let subscription: unknown;
    try {
      subscription = JSON.parse(recipient.token);
    } catch {
      throw new ProviderError(
        this.name,
        "Web push token is not valid JSON",
      );
    }
    const parsed = webPushSubscriptionSchema.safeParse(subscription);
    if (!parsed.success) {
      throw new ProviderError(
        this.name,
        parsed.error.issues[0]?.message ?? "Invalid web push subscription",
      );
    }

    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      ...(message.data && { data: message.data }),
      ...(message.badge !== undefined && { badge: message.badge }),
      ...(message.icon && { icon: message.icon }),
      ...(message.image && { image: message.image }),
      ...(message.clickAction && { clickAction: message.clickAction }),
    });

    const options: Record<string, unknown> = {};
    if (message.ttl !== undefined) options.TTL = message.ttl;
    if (message.priority === "high") options.urgency = "high";
    if (message.priority === "normal") options.urgency = "normal";

    try {
      const result = await lib.sendNotification(parsed.data, payload, options);
      return {
        status: "sent",
        providerMessageId: result?.headers?.["location"],
        provider: this.name,
        platform: "webpush",
        token: recipient.token,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      if (
        error instanceof SubscriptionExpiredError ||
        error instanceof ProviderError ||
        error instanceof RateLimitError
      ) {
        throw error;
      }
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        throw new SubscriptionExpiredError(recipient.token);
      }
      if (status === 429) {
        const retryAfter =
          (error as { headers?: { "retry-after"?: string } }).headers?.[
            "retry-after"
          ];
        const ms = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 60_000;
        throw new RateLimitError(Number.isFinite(ms) ? ms : 60_000);
      }
      throw new ProviderError(
        this.name,
        asMessage(error),
        status?.toString(),
        error,
      );
    }
  }
}

/** Narrow structural type so `web-push` stays out of the build graph. */
interface WebPushLike {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
    payload?: string,
    options?: Record<string, unknown>,
  ): Promise<{ statusCode?: number; headers?: Record<string, string> }>;
}
