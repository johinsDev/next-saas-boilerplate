import type {
  EmailMessageData,
  EmailResponse,
  EmailTransport,
  LogProviderConfig,
  Recipient,
} from "../types";

const BODY_PREVIEW_LEN = 80;

function recipientToString(r: Recipient): string {
  return typeof r === "string" ? r : r.address;
}

/**
 * Local-dev transport. Writes one structured line per send to a
 * `@saas/log` `Logger` instance — feeds into whichever sink the app
 * already uses (pino/console/Better Stack), keeping email observability
 * unified with the rest of the app.
 *
 * Idempotent and pure: never touches the filesystem or network.
 */
export class LogTransport implements EmailTransport {
  readonly name = "log";
  readonly #config: LogProviderConfig;

  constructor(config: LogProviderConfig) {
    this.#config = config;
  }

  async send(message: EmailMessageData): Promise<EmailResponse> {
    const id = `log-${crypto.randomUUID()}`;
    const body = message.text ?? message.html ?? "";
    const preview = body.slice(0, BODY_PREVIEW_LEN);

    this.#config.logger.info(
      {
        _service: "email",
        provider: this.name,
        to: message.to.map(recipientToString),
        from: message.from ? recipientToString(message.from) : undefined,
        subject: message.subject,
        bodyPreview: preview,
        bodyLength: body.length,
        htmlLength: message.html?.length ?? 0,
        textLength: message.text?.length ?? 0,
        attachments: message.attachments?.length ?? 0,
        emailMessageId: id,
      },
      "email.sent",
    );

    return {
      status: "sent",
      providerMessageId: id,
      provider: this.name,
      timestamp: new Date().toISOString(),
    };
  }
}
