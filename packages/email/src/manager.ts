import type { BaseEmail } from "./base-email";
import { FakeSender } from "./fake-sender";
import { EmailSender } from "./sender";
import { FolderTransport } from "./transports/folder";
import { LogTransport } from "./transports/log";
import { OutboxTransport } from "./transports/outbox";
import { ResendTransport } from "./transports/resend";
import type {
  EmailComposeCallback,
  EmailLogLevel,
  EmailLogger,
  EmailManagerConfig,
  EmailResponse,
  EmailTransport,
  ProviderConfig,
} from "./types";

function createTransport(config: ProviderConfig): EmailTransport {
  switch (config.provider) {
    case "resend":
      return new ResendTransport(config);
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
 * Same shape as `SmsManager` / `WhatsAppManager` so testing + bootstrap
 * patterns transfer between channels.
 *
 * @example
 *   export const email = new EmailManager({
 *     default: env.EMAIL_PROVIDER ?? "log",
 *     mailers: {
 *       log: { provider: "log", logger },
 *       outbox: env.DATABASE_URL ? { provider: "outbox", db } : undefined,
 *       resend: env.RESEND_API_KEY
 *         ? { provider: "resend", apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }
 *         : undefined,
 *     },
 *     logger,
 *   });
 */
export class EmailManager<
  TMailers extends Record<string, ProviderConfig | undefined>,
> {
  readonly #config: EmailManagerConfig<TMailers>;
  readonly #logger?: EmailLogger;
  readonly #logLevel: EmailLogLevel;
  readonly #sendersCache = new Map<string, EmailSender>();
  #fakeSender?: FakeSender;

  constructor(
    config: EmailManagerConfig<TMailers> & { logger?: EmailLogger },
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
    callbackOrEmail: EmailComposeCallback | BaseEmail,
  ): Promise<EmailResponse> {
    return this.use().send(callbackOrEmail);
  }

  use<K extends keyof TMailers & string>(mailerName?: K): EmailSender {
    const name = mailerName ?? this.#config.default;
    if (!name) {
      throw new Error(
        "No mailer name provided and no default configured. Set `default` on EmailManagerConfig.",
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
    const sender = new EmailSender(name, transport, {
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
