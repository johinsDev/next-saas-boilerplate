import type {
  EmailMessageData,
  EmailResponse,
  EmailTransport,
  QueueProviderConfig,
} from "../types";

/**
 * Hands the message to a background queue instead of delivering it.
 *
 * The request path stops paying for the provider call: signing in returns as
 * soon as the message is accepted, and delivery gets retries, backoff and a run
 * you can open when a customer says the email never arrived. Switching a whole
 * app onto it is one line of config, exactly like switching `folder` → `resend`.
 *
 * **The dispatcher is injected**, the same way the outbox transport takes its
 * `db`. That keeps `@saas/email` free of a dependency on any particular queue —
 * Trigger.dev is one adapter, and the package should not know its name — and it
 * makes this testable without a queue running at all.
 */
export class QueueTransport implements EmailTransport {
  readonly name = "queue";
  readonly #config: QueueProviderConfig;

  constructor(config: QueueProviderConfig) {
    this.#config = config;
  }

  async send(message: EmailMessageData): Promise<EmailResponse> {
    /*
     * Deliberately not wrapped in a try/catch. A queue that is unreachable is a
     * failure the caller has to see: swallowing it here would make an email
     * that was never accepted look exactly like one that was.
     */
    const handle = await this.#config.dispatch(message);

    return {
      // `queued`, never `sent`. Nothing has reached a provider yet, and the
      // outbox view, the tests and the audit trail all read this field.
      status: "queued",
      provider: this.name,
      // The run id, so a caller can follow the work into the queue's dashboard.
      providerMessageId: handle.id,
      timestamp: new Date().toISOString(),
    };
  }
}
