import type { BasePush } from "./base-push";
import { SubscriptionExpiredError } from "./errors";
import { PushMessage } from "./push-message";
import type {
  PushComposeCallback,
  PushLogLevel,
  PushLogger,
  PushMessageData,
  PushResponse,
  PushTokenLookup,
  PushTransport,
  ResolvedRecipient,
} from "./types";

/**
 * Wraps one or more `PushTransport`s and fans out a message to all of
 * its resolved recipients. The base sender takes a single transport
 * (used by `log`/`outbox`/`webpush`/`expo` providers); the auto sender
 * subclass below holds the `webpush` + `expo` pair and dispatches per
 * recipient platform.
 */
export class PushSender {
  readonly name: string;
  protected readonly logger?: PushLogger;
  protected readonly logLevel: PushLogLevel;
  protected readonly tokenLookup?: PushTokenLookup;
  readonly #transport?: PushTransport;

  constructor(
    name: string,
    transport: PushTransport | undefined,
    options: {
      logger?: PushLogger;
      logLevel?: PushLogLevel;
      tokenLookup?: PushTokenLookup;
    } = {},
  ) {
    this.name = name;
    this.#transport = transport;
    this.logger = options.logger;
    this.logLevel = options.logLevel ?? "info";
    this.tokenLookup = options.tokenLookup;
  }

  /**
   * Send via callback (`(m) => m.toUser(id).title(...).body(...)`) or
   * pass a `BasePush` instance.
   */
  async send(
    callbackOrPush: PushComposeCallback | BasePush,
  ): Promise<PushResponse[]> {
    if (typeof callbackOrPush !== "function") {
      return callbackOrPush.send(this);
    }
    const message = new PushMessage();
    await callbackOrPush(message);
    return this.sendCompiled(message.toData());
  }

  /** Internal: send an already-compiled payload to all resolved devices. */
  async sendCompiled(data: PushMessageData): Promise<PushResponse[]> {
    const resolved = await this.resolveRecipients(data);
    if (resolved.length === 0) {
      this.log("info", { mailer: this.name, title: data.title }, "no-recipients");
      return [];
    }
    const responses = await Promise.all(
      resolved.map((recipient) => this.dispatch(data, recipient)),
    );
    return responses;
  }

  protected async dispatch(
    data: PushMessageData,
    recipient: ResolvedRecipient,
  ): Promise<PushResponse> {
    if (!this.#transport) {
      throw new Error(
        `Sender "${this.name}" has no transport configured for platform "${recipient.platform}"`,
      );
    }
    this.log(
      "info",
      {
        mailer: this.name,
        platform: recipient.platform,
        tokenPreview: recipient.token.slice(0, 16),
        title: data.title,
      },
      "sending",
    );
    try {
      const response = await this.#transport.send(data, recipient);
      this.log(
        "info",
        {
          mailer: this.name,
          platform: recipient.platform,
          tokenPreview: recipient.token.slice(0, 16),
          providerMessageId: response.providerMessageId,
          status: response.status,
        },
        "sent",
      );
      return response;
    } catch (err) {
      if (err instanceof SubscriptionExpiredError) {
        this.log(
          "warn",
          {
            mailer: this.name,
            platform: recipient.platform,
            tokenPreview: recipient.token.slice(0, 16),
          },
          "expired",
        );
        return {
          status: "expired",
          provider: this.#transport.name,
          platform: recipient.platform,
          token: recipient.token,
          timestamp: new Date().toISOString(),
          error: err.message,
        };
      }
      throw err;
    }
  }

  /**
   * Convert the mixed `recipients` array into device-level recipients.
   * Falls back to no-op for `kind: "user"` recipients when no
   * `tokenLookup` is wired (the log/outbox transports use direct token
   * recipients only).
   */
  protected async resolveRecipients(
    data: PushMessageData,
  ): Promise<ResolvedRecipient[]> {
    const resolved: ResolvedRecipient[] = [];
    for (const recipient of data.recipients) {
      if (recipient.kind === "token") {
        resolved.push(recipient);
        continue;
      }
      if (!this.tokenLookup) {
        throw new Error(
          `Sender "${this.name}" received a user-recipient (${recipient.userId}) but no tokenLookup is configured`,
        );
      }
      const tokens = await this.tokenLookup(recipient.userId);
      for (const t of tokens) {
        resolved.push({ kind: "token", token: t.token, platform: t.platform });
      }
    }
    return resolved;
  }

  protected log(
    level: "info" | "warn" | "debug",
    bindings: Record<string, unknown>,
    msg: string,
  ): void {
    if (this.logLevel === "silent") return;
    if (level === "debug" && this.logLevel !== "debug") return;
    if (this.logger) {
      const fn = level === "warn" ? this.logger.warn : this.logger.info;
      fn.call(this.logger, { ...bindings, _service: "push" }, msg);
      return;
    }
    console.log("[push]", msg, bindings);
  }
}

/**
 * Composite sender used by the `auto` provider: holds one transport
 * per platform and routes each resolved recipient accordingly. This
 * is the production default — preview uses `outbox`, dev uses `log`.
 */
export class AutoPushSender extends PushSender {
  readonly #webpush: PushTransport;
  readonly #expo: PushTransport;

  constructor(
    name: string,
    transports: { webpush: PushTransport; expo: PushTransport },
    options: {
      logger?: PushLogger;
      logLevel?: PushLogLevel;
      tokenLookup?: PushTokenLookup;
    },
  ) {
    super(name, undefined, options);
    this.#webpush = transports.webpush;
    this.#expo = transports.expo;
  }

  protected override async dispatch(
    data: PushMessageData,
    recipient: ResolvedRecipient,
  ): Promise<PushResponse> {
    const transport =
      recipient.platform === "webpush" ? this.#webpush : this.#expo;
    this.log(
      "info",
      {
        mailer: this.name,
        platform: recipient.platform,
        tokenPreview: recipient.token.slice(0, 16),
        title: data.title,
      },
      "sending",
    );
    try {
      const response = await transport.send(data, recipient);
      this.log(
        "info",
        {
          mailer: this.name,
          platform: recipient.platform,
          tokenPreview: recipient.token.slice(0, 16),
          providerMessageId: response.providerMessageId,
          status: response.status,
        },
        "sent",
      );
      return response;
    } catch (err) {
      if (err instanceof SubscriptionExpiredError) {
        this.log(
          "warn",
          {
            mailer: this.name,
            platform: recipient.platform,
            tokenPreview: recipient.token.slice(0, 16),
          },
          "expired",
        );
        return {
          status: "expired",
          provider: transport.name,
          platform: recipient.platform,
          token: recipient.token,
          timestamp: new Date().toISOString(),
          error: err.message,
        };
      }
      throw err;
    }
  }
}
