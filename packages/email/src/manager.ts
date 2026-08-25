import type { BaseEmail } from "./base-email";
import { FakeSender } from "./fake-sender";
import { EmailSender } from "./sender";
import { FolderTransport } from "./transports/folder";
import { LogTransport } from "./transports/log";
import { OutboxTransport } from "./transports/outbox";
import { DeferredTransport } from "./transports/deferred";
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
    /*
     * Spread, then override the one field that needs reshaping.
     *
     * This used to name each field it kept, which silently dropped `queue` the
     * day it was added — and TypeScript could not see it, because the narrower
     * object still satisfies the type when the missing field is optional. The
     * symptom was a config that looked right, an environment that was right,
     * and mail that still went to a file.
     */
    this.#config = { ...config, mailers: definedMailers };
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

    /*
     * Two independent questions, in the order they are asked: `mailers` picked
     * *where* this goes, and `queue` picks *when*. When a queue is configured
     * the chosen mailer becomes a routing label the worker resolves — this
     * process never touches the provider, which is the point.
     */
    const deferred = this.#config.queue;
    const transport = deferred ? new DeferredTransport(deferred) : createTransport(mailerConfig);
    /*
     * When deferring, the sender is named after the queue's target rather than
     * the local mailer key. Otherwise every log line reads `mailer: "folder"`
     * beside `status: "queued"` and a run id — three fields telling two
     * different stories about where the mail went.
     */
    const sender = new EmailSender(deferred ? deferred.mailer : name, transport, {
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
