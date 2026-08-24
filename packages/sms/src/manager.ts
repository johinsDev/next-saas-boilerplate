import type { BaseSms } from "./base-sms";
import { FakeSender } from "./fake-sender";
import { SmsSender } from "./sender";
import { FolderTransport } from "./transports/folder";
import { LogTransport } from "./transports/log";
import { OutboxTransport } from "./transports/outbox";
import { TwilioTransport } from "./transports/twilio";
import type {
  ProviderConfig,
  SmsComposeCallback,
  SmsLogLevel,
  SmsLogger,
  SmsManagerConfig,
  SmsResponse,
  SmsTransport,
} from "./types";

function createTransport(config: ProviderConfig): SmsTransport {
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
 * Same shape as `WhatsAppManager`.
 *
 * @example
 *   export const sms = new SmsManager({
 *     default: env.SMS_PROVIDER ?? "log",
 *     mailers: {
 *       log: { provider: "log", logger },
 *       twilio: env.TWILIO_ACCOUNT_SID
 *         ? {
 *             provider: "twilio",
 *             accountSid: env.TWILIO_ACCOUNT_SID,
 *             authToken: env.TWILIO_AUTH_TOKEN,
 *             from: env.TWILIO_SMS_FROM,
 *           }
 *         : undefined,
 *       outbox: env.DATABASE_URL ? { provider: "outbox", db } : undefined,
 *     },
 *     logger,
 *   });
 */
export class SmsManager<
  TMailers extends Record<string, ProviderConfig | undefined>,
> {
  readonly #config: SmsManagerConfig<TMailers>;
  readonly #logger?: SmsLogger;
  readonly #logLevel: SmsLogLevel;
  readonly #sendersCache = new Map<string, SmsSender>();
  #fakeSender?: FakeSender;

  constructor(
    config: SmsManagerConfig<TMailers> & { logger?: SmsLogger },
  ) {
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
    callbackOrSms: SmsComposeCallback | BaseSms,
  ): Promise<SmsResponse> {
    return this.use().send(callbackOrSms);
  }

  use<K extends keyof TMailers & string>(mailerName?: K): SmsSender {
    const name = mailerName ?? this.#config.default;
    if (!name) {
      throw new Error(
        "No mailer name provided and no default configured. Set `default` on SmsManagerConfig.",
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
    const sender = new SmsSender(name, transport, {
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
