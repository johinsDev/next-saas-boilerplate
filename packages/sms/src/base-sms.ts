import type { SmsSender } from "./sender";
import { SmsMessage } from "./sms-message";
import type { SmsResponse } from "./types";

/**
 * Base class for typed SMS notifications. Subclass per use-case
 * (OtpSms, AppointmentReminderSms, OrderShippedSms…) and implement
 * `prepare()`.
 *
 * @example
 *   export class OtpSms extends BaseSms {
 *     constructor(private readonly phone: string, private readonly code: string) {
 *       super();
 *     }
 *     prepare() {
 *       this.message
 *         .to(this.phone)
 *         .content(`Tu codigo es ${this.code}. Expira en 5 minutos.`);
 *     }
 *   }
 */
export abstract class BaseSms {
  #built = false;
  message = new SmsMessage();

  /** Configure `this.message`. Called exactly once by `build()`. */
  abstract prepare(): void | Promise<void>;

  /**
   * Override to conditionally skip sending. Use from queue handlers
   * to gate on per-recipient opt-out or quiet hours.
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

  /** Called by `SmsSender` when it receives a `BaseSms` instance. */
  async send(sender: SmsSender): Promise<SmsResponse> {
    await this.build();
    return sender.sendCompiled(this.message.toData());
  }
}
