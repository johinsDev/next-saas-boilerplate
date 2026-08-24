import type {
  EmailMessageData,
  EmailResponse,
  EmailTransport,
  OutboxProviderConfig,
  Recipient,
} from "../types";

function recipientToString(r: Recipient): string {
  return typeof r === "string" ? r : r.address;
}

/**
 * Preview-deploy transport. Persists each send to `email_outbox`
 * (Drizzle). Feeds the dev "Email Outbox" view AND the
 * `/api/email-outbox` endpoint that Playwright uses.
 *
 * The Drizzle `db` instance is injected via config so this package
 * stays free of an import-time DB dependency.
 *
 * Lazy-imports the schema to avoid loading `@saas/db` when the
 * outbox provider isn't selected.
 */
export class OutboxTransport implements EmailTransport {
  readonly name = "outbox";
  readonly #config: OutboxProviderConfig;

  constructor(config: OutboxProviderConfig) {
    this.#config = config;
  }

  async send(message: EmailMessageData): Promise<EmailResponse> {
    const dbSchema = (await import("@saas/db/schema")) as unknown as {
      emailOutbox: unknown;
    };
    const { emailOutbox } = dbSchema;

    const sentAt = new Date();
    const to = message.to.map(recipientToString).join(", ");
    const from = message.from ? recipientToString(message.from) : null;
    const replyTo = message.replyTo ? recipientToString(message.replyTo) : null;
    const cc = message.cc?.length
      ? message.cc.map(recipientToString).join(", ")
      : null;
    const bcc = message.bcc?.length
      ? message.bcc.map(recipientToString).join(", ")
      : null;

    const rows = (await this.#config.db
      .insert(emailOutbox)
      .values({
        to,
        from,
        replyTo,
        cc,
        bcc,
        subject: message.subject,
        html: message.html ?? null,
        text: message.text ?? null,
        status: "sent",
        sentAt,
        metadata: {
          ...(message.tags?.length && { tags: message.tags }),
          ...(message.headers && { headers: message.headers }),
          ...(message.priority && { priority: message.priority }),
          ...(message.attachments?.length && {
            attachments: message.attachments.map((a) => ({
              filename: a.filename,
              contentType: a.contentType,
              size:
                typeof a.content === "string"
                  ? a.content.length
                  : a.content.byteLength,
            })),
          }),
        },
      })
      .returning()) as { id: string }[];

    const inserted = rows[0];
    if (!inserted) {
      throw new Error("email outbox insert returned no rows");
    }

    return {
      status: "sent",
      providerMessageId: `outbox-${inserted.id}`,
      provider: this.name,
      timestamp: sentAt.toISOString(),
    };
  }
}
