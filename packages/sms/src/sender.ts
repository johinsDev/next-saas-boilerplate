import type { BaseSms } from "./base-sms";
import { SmsMessage } from "./sms-message";
import type {
  SmsComposeCallback,
  SmsLogLevel,
  SmsLogger,
  SmsMessageData,
  SmsResponse,
  SmsTransport,
} from "./types";

/**
 * Wraps a single `SmsTransport` and adds structured logging.
 * One sender per named mailer; manager caches instances.
 */
export class SmsSender {
  readonly name: string;
  readonly #transport: SmsTransport;
  readonly #logger?: SmsLogger;
  readonly #logLevel: SmsLogLevel;

  constructor(
    name: string,
    transport: SmsTransport,
    options: { logger?: SmsLogger; logLevel?: SmsLogLevel } = {},
  ) {
    this.name = name;
    this.#transport = transport;
    this.#logger = options.logger;
    this.#logLevel = options.logLevel ?? "info";
  }

  /**
   * Send via callback (`(m) => m.to(...).content(...)`) or pass a
   * `BaseSms` instance.
   */
  async send(
    callbackOrSms: SmsComposeCallback | BaseSms,
  ): Promise<SmsResponse> {
    if (typeof callbackOrSms !== "function") {
      return callbackOrSms.send(this);
    }
    const message = new SmsMessage();
    await callbackOrSms(message);
    return this.sendCompiled(message.toData());
  }

  /** Internal: send an already-compiled payload via the transport. */
  async sendCompiled(data: SmsMessageData): Promise<SmsResponse> {
    this.#log("info", { to: data.to, mailer: this.name }, "sending");
    const response = await this.#transport.send(data);
    this.#log(
      "info",
      {
        to: data.to,
        mailer: this.name,
        providerMessageId: response.providerMessageId,
        status: response.status,
        segments: response.segments?.count,
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
      this.#logger.info({ ...bindings, _service: "sms" }, msg);
      return;
    }
    console.log("[sms]", msg, bindings);
  }
}
