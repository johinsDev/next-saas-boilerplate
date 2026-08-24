import type {
  LogProviderConfig,
  WhatsAppMessageData,
  WhatsAppResponse,
  WhatsAppTransport,
} from "../types";

const BODY_PREVIEW_LEN = 80;

/**
 * Local-dev transport. Writes one structured line per send to a
 * `@saas/log` `Logger` instance — feeds into whichever sink the app
 * already uses (pino/console/Better Stack), keeping WhatsApp observability
 * unified with the rest of the app.
 *
 * Idempotent and pure: never touches the filesystem or network.
 */
export class LogTransport implements WhatsAppTransport {
  readonly name = "log";
  readonly #config: LogProviderConfig;

  constructor(config: LogProviderConfig) {
    this.#config = config;
  }

  async send(message: WhatsAppMessageData): Promise<WhatsAppResponse> {
    const id = `log-${crypto.randomUUID()}`;
    const preview = message.content.slice(0, BODY_PREVIEW_LEN);

    this.#config.logger.info(
      {
        _service: "whatsapp",
        provider: this.name,
        to: message.to,
        from: message.from,
        bodyPreview: preview,
        bodyLength: message.content.length,
        media: message.mediaUrl ? 1 : 0,
        contentSid: message.contentSid,
        whatsappMessageId: id,
      },
      "whatsapp.sent",
    );

    return {
      status: "sent",
      providerMessageId: id,
      provider: this.name,
      timestamp: new Date().toISOString(),
    };
  }
}
