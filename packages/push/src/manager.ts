import type { BasePush } from "./base-push";
import { FakeSender } from "./fake-sender";
import { AutoPushSender, PushSender } from "./sender";
import { ExpoTransport } from "./transports/expo";
import { LogTransport } from "./transports/log";
import { OutboxTransport } from "./transports/outbox";
import { WebPushTransport } from "./transports/webpush";
import type {
  ProviderConfig,
  PushComposeCallback,
  PushLogLevel,
  PushLogger,
  PushManagerConfig,
  PushResponse,
  PushTokenLookup,
} from "./types";

/**
 * Owns the named senders and routes `send()` calls to the active one.
 * Same shape as `SmsManager` / `EmailManager` so testing + bootstrap
 * patterns transfer between channels.
 *
 * @example
 *   export const push = new PushManager({
 *     default: env.PUSH_PROVIDER ?? "log",
 *     senders: {
 *       log: { provider: "log", logger },
 *       outbox: { provider: "outbox", db },
 *       webpush: vapid ? { provider: "webpush", ...vapid } : undefined,
 *       expo: { provider: "expo", accessToken: env.EXPO_ACCESS_TOKEN },
 *       auto: vapid
 *         ? { provider: "auto", webpush: vapid, expo: { ... }, tokenLookup }
 *         : undefined,
 *     },
 *     logger,
 *   });
 */
export class PushManager<
  TSenders extends Record<string, ProviderConfig | undefined>,
> {
  readonly #config: PushManagerConfig<TSenders>;
  readonly #logger?: PushLogger;
  readonly #logLevel: PushLogLevel;
  readonly #tokenLookup?: PushTokenLookup;
  readonly #sendersCache = new Map<string, PushSender>();
  #fakeSender?: FakeSender;

  constructor(
    config: PushManagerConfig<TSenders> & { logger?: PushLogger },
  ) {
    const definedSenders = Object.fromEntries(
      Object.entries(config.senders).filter(([, v]) => v !== undefined),
    ) as TSenders;
    this.#config = {
      default: config.default,
      senders: definedSenders,
      logLevel: config.logLevel,
    };
    this.#logger = config.logger;
    this.#logLevel = config.logLevel ?? "info";
    this.#tokenLookup = config.tokenLookup;
  }

  send(
    callbackOrPush: PushComposeCallback | BasePush,
  ): Promise<PushResponse[]> {
    return this.use().send(callbackOrPush);
  }

  use<K extends keyof TSenders & string>(senderName?: K): PushSender {
    const name = senderName ?? this.#config.default;
    if (!name) {
      throw new Error(
        "No sender name provided and no default configured. Set `default` on PushManagerConfig.",
      );
    }
    const senderConfig = this.#config.senders[name];
    if (!senderConfig) {
      throw new Error(
        `Unknown sender "${name}". Configured: ${Object.keys(this.#config.senders).join(", ") || "<none>"}`,
      );
    }

    if (this.#fakeSender) return this.#fakeSender;

    const cached = this.#sendersCache.get(name);
    if (cached) return cached;

    const sender = this.#buildSender(name, senderConfig);
    this.#sendersCache.set(name, sender);
    return sender;
  }

  #buildSender(name: string, config: ProviderConfig): PushSender {
    // Manager-level tokenLookup reaches every sender so `toUser(...)`
    // resolves regardless of the active provider (log/outbox included).
    const senderOpts = {
      logger: this.#logger,
      logLevel: this.#logLevel,
      tokenLookup: this.#tokenLookup,
    };
    switch (config.provider) {
      case "auto":
        return new AutoPushSender(
          name,
          {
            webpush: new WebPushTransport(config.webpush),
            expo: new ExpoTransport(config.expo),
          },
          { ...senderOpts, tokenLookup: config.tokenLookup ?? this.#tokenLookup },
        );
      case "webpush":
        return new PushSender(name, new WebPushTransport(config), senderOpts);
      case "expo":
        return new PushSender(name, new ExpoTransport(config), senderOpts);
      case "log":
        return new PushSender(name, new LogTransport(config), senderOpts);
      case "outbox":
        return new PushSender(name, new OutboxTransport(config), senderOpts);
    }
  }

  /** Activate the fake sender. Subsequent `use()` returns the fake. */
  fake(): FakeSender {
    this.restore();
    this.#fakeSender = new FakeSender();
    return this.#fakeSender;
  }

  /** Disable fake mode (cleans up after tests). */
  restore(): void {
    this.#fakeSender = undefined;
  }
}
