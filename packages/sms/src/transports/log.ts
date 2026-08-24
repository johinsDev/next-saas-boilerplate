import { smsSegmentInfo } from "../schemas";
import type {
  LogProviderConfig,
  SmsMessageData,
  SmsResponse,
  SmsTransport,
} from "../types";

const BODY_PREVIEW_LEN = 80;

/**
 * Local-dev transport. Writes one structured line per send to a
 * `@saas/log` `Logger` instance — feeds into whichever sink the app
 * already uses (pino/console/Better Stack), keeping SMS observability
 * unified with the rest of the app.
 *
 * Idempotent and pure: never touches the filesystem or network.
 */
export class LogTransport implements SmsTransport {
  readonly name = "log";
  readonly #config: LogProviderConfig;

  constructor(config: LogProviderConfig) {
    this.#config = config;
  }

  async send(message: SmsMessageData): Promise<SmsResponse> {
    const id = `log-${crypto.randomUUID()}`;
    const preview = message.content.slice(0, BODY_PREVIEW_LEN);
    const seg = smsSegmentInfo(message.content);

    this.#config.logger.info(
      {
        _service: "sms",
        provider: this.name,
        to: message.to,
        from: message.from,
        bodyPreview: preview,
        bodyLength: message.content.length,
        encoding: seg.encoding,
        segments: seg.segments,
        smsMessageId: id,
      },
      "sms.sent",
    );

    return {
      status: "sent",
      providerMessageId: id,
      provider: this.name,
      timestamp: new Date().toISOString(),
      segments: {
        encoding: seg.encoding,
        characters: seg.characters,
        count: seg.segments,
      },
    };
  }
}
