import { EmailMessage } from "./email-message";
import type { EmailSender } from "./sender";
import type { EmailResponse } from "./types";

/**
 * Base class for typed email notifications. Subclass per use-case
 * (WelcomeEmail, PasswordResetEmail, PointsEarnedEmail…) and implement
 * `prepare()`.
 *
 * The actual HTML body is typically built by importing a React Email
 * template + `renderEmail()` from `@saas/email-templates`, then
 * passing the rendered string to `this.message.html(...)`.
 *
 * @example
 *   import { renderEmail, WelcomeEmail as WelcomeTemplate } from "@saas/email-templates";
 *
 *   export class WelcomeEmail extends BaseEmail {
 *     constructor(
 *       private readonly to: string,
 *       private readonly name: string,
 *       private readonly ctaUrl: string,
 *     ) { super(); }
 *
 *     async prepare() {
 *       const html = await renderEmail(<WelcomeTemplate name={this.name} ctaUrl={this.ctaUrl} />);
 *       this.message
 *         .to(this.to, this.name)
 *         .subject("¡Bienvenida a Acme!")
 *         .html(html);
 *     }
 *   }
 */
export abstract class BaseEmail {
  #built = false;
  message = new EmailMessage();

  /** Configure `this.message`. Called exactly once by `build()`. */
  abstract prepare(): void | Promise<void>;

  /**
   * Override to conditionally skip sending. Use from queue handlers
   * to gate on per-recipient opt-out or marketing preferences.
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

  /** Called by `EmailSender` when it receives a `BaseEmail` instance. */
  async send(sender: EmailSender): Promise<EmailResponse> {
    await this.build();
    return sender.sendCompiled(this.message.toData());
  }
}
