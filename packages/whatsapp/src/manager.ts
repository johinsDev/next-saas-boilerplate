import type { BaseWhatsApp } from "./base-whatsapp";
import { FakeSender } from "./fake-sender";
import { WhatsAppSender } from "./sender";
import { FolderTransport } from "./transports/folder";
import { LogTransport } from "./transports/log";
import { OutboxTransport } from "./transports/outbox";
import { TwilioTransport } from "./transports/twilio";
import type {
  ProviderConfig,
  WhatsAppComposeCallback,
  WhatsAppLogger,
  WhatsAppLogLevel,
  WhatsAppManagerConfig,
  WhatsAppResponse,
  WhatsAppTransport,
} from "./types";

function createTransport(config: ProviderConfig): WhatsAppTransport {
  switch (config.provider) {
    case "twilio":
      return new TwilioTransport(config);
    case "log":
      return new LogTransport(config);
    case "folder":
      return new FolderTransport(config);
    case "outbox":
      return new OutboxTransport(config);
  }
}

/**
 * Owns the named mailers and routes `send()` calls to the active one.
 * Same shape as `LogManager` in `@saas/log`.
 *
 * @example
 *   export const whatsapp = new WhatsAppManager({
 *     default: env.WHATSAPP_PROVIDER ?? "log",
 *     mailers: {
 *       log: { provider: "log", logger },
 *       twilio: env.TWILIO_ACCOUNT_SID
 *         ? {
 *             provider: "twilio",
 *             accountSid: env.TWILIO_ACCOUNT_SID,
 *             authToken: env.TWILIO_AUTH_TOKEN,
 *             from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
 *           }
 *         : undefined,
 *       outbox: env.DATABASE_URL ? { provider: "outbox", db } : undefined,
 *     },
 *     logger,
 *   });
 */
export class WhatsAppManager<
  TMailers extends Record<string, ProviderConfig | undefined>,
> {
  readonly #config: WhatsAppManagerConfig<TMailers>;
  readonly #logger?: WhatsAppLogger;
  readonly #logLevel: WhatsAppLogLevel;
  readonly #sendersCache = new Map<string, WhatsAppSender>();
  #fakeSender?: FakeSender;

  constructor(
    config: WhatsAppManagerConfig<TMailers> & { logger?: WhatsAppLogger },
  ) {
    // Strip out undefined mailers so users can conditionally include them.
    const definedMailers = Object.fromEntries(
      Object.entries(config.mailers).filter(([, v]) => v !== undefined),
    ) as TMailers;
    this.#config = {
      default: config.default,
      mailers: definedMailers,
      logLevel: config.logLevel,
    };
    this.#logger = config.logger;
    this.#logLevel = config.logLevel ?? "info";
  }

  send(
    callbackOrWhatsApp: WhatsAppComposeCallback | BaseWhatsApp,
  ): Promise<WhatsAppResponse> {
    return this.use().send(callbackOrWhatsApp);
  }

  use<K extends keyof TMailers & string>(mailerName?: K): WhatsAppSender {
    const name = mailerName ?? this.#config.default;
    if (!name) {
      throw new Error(
        "No mailer name provided and no default configured. Set `default` on WhatsAppManagerConfig.",
      );
    }
    const mailerConfig = this.#config.mailers[name];
    if (!mailerConfig) {
      throw new Error(
        `Unknown mailer "${name}". Configured: ${Object.keys(this.#config.mailers).join(", ") || "<none>"}`,
      );
    }

    if (this.#fakeSender) return this.#fakeSender;

    const cached = this.#sendersCache.get(name);
    if (cached) return cached;

    const transport = createTransport(mailerConfig);
    const sender = new WhatsAppSender(name, transport, {
      logger: this.#logger,
      logLevel: this.#logLevel,
    });
    this.#sendersCache.set(name, sender);
    return sender;
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
