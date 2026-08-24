import type { WhatsAppResponse } from "./types";
import { WhatsAppMessage } from "./whatsapp-message";
import type { WhatsAppSender } from "./sender";

/**
 * Base class for typed WhatsApp messages. Subclass per use-case
 * (BirthdayWhatsApp, PointsEarnedWhatsApp, RedemptionReadyWhatsApp...)
 * and implement `prepare()`.
 *
 * @example
 *   export class BirthdayWhatsApp extends BaseWhatsApp {
 *     constructor(private readonly phone: string, private readonly name: string) {
 *       super();
 *     }
 *     prepare() {
 *       this.message
 *         .to(this.phone)
 *         .emoji("tada")
 *         .content(" ¡Feliz cumpleaños, ")
 *         .bold(this.name)
 *         .content("! Tenés 2 sellos de regalo.");
 *     }
 *   }
 */
export abstract class BaseWhatsApp {
  #built = false;
  message = new WhatsAppMessage();

  /** Configure `this.message`. Called exactly once by `build()`. */
  abstract prepare(): void | Promise<void>;

  /**
   * Override to conditionally skip sending. Use from queue handlers
   * to gate on per-recipient opt-in or cooldowns.
   */
  shouldSend(): boolean | Promise<boolean> {
    return true;
  }

  /** Idempotent — multiple calls run `prepare()` only once. */
  async build(): Promise<void> {
    if (this.#built) return;
    this.#built = true;
    await this.prepare();
  }

  /** Called by `WhatsAppSender` when it receives a `BaseWhatsApp` instance. */
  async send(sender: WhatsAppSender): Promise<WhatsAppResponse> {
    await this.build();
    return sender.sendCompiled(this.message.toData());
  }
}
