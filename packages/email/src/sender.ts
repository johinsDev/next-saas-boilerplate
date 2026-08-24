import type { BaseEmail } from "./base-email";
import { EmailMessage } from "./email-message";
import type {
  EmailComposeCallback,
  EmailLogLevel,
  EmailLogger,
  EmailMessageData,
  EmailResponse,
  EmailTransport,
  Recipient,
} from "./types";

function recipientToString(recipient: Recipient): string {
  return typeof recipient === "string" ? recipient : recipient.address;
}

/**
 * Wraps a single `EmailTransport` and adds structured logging.
 * One sender per named mailer; manager caches instances.
 */
export class EmailSender {
  readonly name: string;
  readonly #transport: EmailTransport;
  readonly #logger?: EmailLogger;
  readonly #logLevel: EmailLogLevel;

  constructor(
    name: string,
    transport: EmailTransport,
    options: { logger?: EmailLogger; logLevel?: EmailLogLevel } = {},
  ) {
    this.name = name;
    this.#transport = transport;
    this.#logger = options.logger;
    this.#logLevel = options.logLevel ?? "info";
  }

  /**
   * Send via callback (`(m) => m.to(...).subject(...).html(...)`) or
   * pass a `BaseEmail` instance.
   */
  async send(
    callbackOrEmail: EmailComposeCallback | BaseEmail,
  ): Promise<EmailResponse> {
    if (typeof callbackOrEmail !== "function") {
      return callbackOrEmail.send(this);
    }
    const message = new EmailMessage();
    await callbackOrEmail(message);
    return this.sendCompiled(message.toData());
  }

  /** Internal: send an already-compiled payload via the transport. */
  async sendCompiled(data: EmailMessageData): Promise<EmailResponse> {
    const to = data.to.map(recipientToString).join(", ");
    this.#log("info", { to, mailer: this.name, subject: data.subject }, "sending");
    const response = await this.#transport.send(data);
    this.#log(
      "info",
      {
        to,
        mailer: this.name,
        providerMessageId: response.providerMessageId,
        status: response.status,
      },
      "sent",
    );
    return response;
  }

  #log(
    level: "info" | "debug",
    bindings: Record<string, unknown>,
    msg: string,
  ): void {
    if (this.#logLevel === "silent") return;
    if (level === "debug" && this.#logLevel !== "debug") return;
    if (this.#logger) {
      this.#logger.info({ ...bindings, _service: "email" }, msg);
      return;
    }
    console.log("[email]", msg, bindings);
  }
}
