import type {
  EmailMessageData,
  EmailQueueConfig,
  EmailResponse,
  EmailTransport,
} from "../types";

/**
 * Hands the message to a background worker instead of delivering it here.
 *
 * **This is not a provider, and it is not selected like one.** A provider
 * answers *where* the mail goes; this answers *when*. It wraps whichever mailer
 * was chosen, so "deliver through Resend, but not on the request path" stays
 * expressible — collapsing the two into one enum makes that sentence
 * unsayable, which is exactly what the first version of this got wrong.
 *
 * The request path stops paying for the provider call: signing in returns as
 * soon as the message is accepted, and delivery gets retries, backoff and a run
 * you can open when a customer says the email never arrived.
 */
export class DeferredTransport implements EmailTransport {
  readonly #config: EmailQueueConfig;

  constructor(config: EmailQueueConfig) {
    this.#config = config;
  }

  /** The destination, not "queue" — the queue is how it travels, not where. */
  get name(): string {
    return this.#config.mailer;
  }

  async send(message: EmailMessageData): Promise<EmailResponse> {
    /*
     * Deliberately not wrapped in a try/catch. A queue that is unreachable is a
     * failure the caller has to see: swallowing it here would make an email
     * that was never accepted look exactly like one that was.
     */
    const handle = await this.#config.dispatch({ mailer: this.#config.mailer, message });

    return {
      // `queued`, never `sent`. Nothing has reached a provider yet, and logs,
      // tests and audit trails all read this field.
      status: "queued",
      provider: this.name,
      // The run id, so a caller can follow the work into the queue's dashboard.
      providerMessageId: handle.id,
      timestamp: new Date().toISOString(),
    };
  }
}
