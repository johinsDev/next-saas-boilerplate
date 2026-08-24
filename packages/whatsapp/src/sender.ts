import type { BaseWhatsApp } from "./base-whatsapp";
import type {
  WhatsAppComposeCallback,
  WhatsAppLogger,
  WhatsAppLogLevel,
  WhatsAppMessageData,
  WhatsAppResponse,
  WhatsAppTransport,
} from "./types";
import { WhatsAppMessage } from "./whatsapp-message";

/**
 * Wraps a single `WhatsAppTransport` and adds structured logging.
 * One sender per named mailer; manager caches instances.
 */
export class WhatsAppSender {
  readonly name: string;
  readonly #transport: WhatsAppTransport;
  readonly #logger?: WhatsAppLogger;
  readonly #logLevel: WhatsAppLogLevel;

  constructor(
    name: string,
    transport: WhatsAppTransport,
    options: { logger?: WhatsAppLogger; logLevel?: WhatsAppLogLevel } = {},
  ) {
    this.name = name;
    this.#transport = transport;
    this.#logger = options.logger;
    this.#logLevel = options.logLevel ?? "info";
  }

  /**
   * Send via callback (`(m) => m.to(...).content(...)`) or pass a
   * `BaseWhatsApp` instance.
   */
  async send(
    callbackOrWhatsApp: WhatsAppComposeCallback | BaseWhatsApp,
  ): Promise<WhatsAppResponse> {
    if (typeof callbackOrWhatsApp !== "function") {
      return callbackOrWhatsApp.send(this);
    }
    const message = new WhatsAppMessage();
    await callbackOrWhatsApp(message);
    return this.sendCompiled(message.toData());
  }

  /** Internal: send an already-compiled payload via the transport. */
  async sendCompiled(data: WhatsAppMessageData): Promise<WhatsAppResponse> {
    this.#log("info", { to: data.to, mailer: this.name }, "sending");
    const response = await this.#transport.send(data);
    this.#log(
      "info",
      {
        to: data.to,
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
      this.#logger.info({ ...bindings, _service: "whatsapp" }, msg);
      return;
    }
    // Fallback when no `@saas/log` logger is wired (rare; tests, scripts).
    console.log("[whatsapp]", msg, bindings);
  }
}
