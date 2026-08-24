import type {
  LogProviderConfig,
  PushMessageData,
  PushResponse,
  PushTransport,
  ResolvedRecipient,
} from "../types";

/**
 * Local-dev transport. Writes one structured line per send to a
 * `@saas/log` `Logger` instance — feeds into whichever sink the
 * app already uses (pino/console/Better Stack), keeping push
 * observability unified with the rest of the app.
 *
 * Idempotent and pure: never touches the filesystem or network.
 */
export class LogTransport implements PushTransport {
  readonly name = "log";
  readonly #config: LogProviderConfig;

  constructor(config: LogProviderConfig) {
    this.#config = config;
  }

  async send(
    message: PushMessageData,
    recipient: ResolvedRecipient,
  ): Promise<PushResponse> {
    const id = `log-${crypto.randomUUID()}`;

    this.#config.logger.info(
      {
        _service: "push",
        provider: this.name,
        platform: recipient.platform,
        tokenPreview: recipient.token.slice(0, 16),
        title: message.title,
        body: message.body,
        dataKeys: message.data ? Object.keys(message.data) : [],
        clickAction: message.clickAction,
        pushMessageId: id,
      },
      "push.sent",
    );

    return {
      status: "sent",
      providerMessageId: id,
      provider: this.name,
      platform: recipient.platform,
      token: recipient.token,
      timestamp: new Date().toISOString(),
    };
  }
}
