import type {
  OutboxProviderConfig,
  WhatsAppMessageData,
  WhatsAppResponse,
  WhatsAppTransport,
} from "../types";

/**
 * Preview-deploy transport. Persists each send to `whatsapp_outbox`
 * (Drizzle). Feeds the admin "WhatsApp Outbox" panel AND the
 * `/api/whatsapp-outbox` endpoint that Playwright uses.
 *
 * The Drizzle `db` instance is injected via config so this package
 * stays free of an import-time DB dependency.
 *
 * Lazy-imports the schema to avoid loading `@saas/db` when the
 * outbox provider isn't selected.
 */
export class OutboxTransport implements WhatsAppTransport {
  readonly name = "outbox";
  readonly #config: OutboxProviderConfig;

  constructor(config: OutboxProviderConfig) {
    this.#config = config;
  }

  async send(message: WhatsAppMessageData): Promise<WhatsAppResponse> {
    // Lazy import so consumers of other transports don't pull `@saas/db`.
    // Cast through `unknown` since the schema export is added in a downstream
    // package; typecheck without `@saas/db` rebuilt would otherwise fail.
    const dbSchema = (await import("@saas/db/schema")) as unknown as {
      whatsappOutbox: unknown;
    };
    const { whatsappOutbox } = dbSchema;

    const sentAt = new Date();
    const rows = (await this.#config.db
      .insert(whatsappOutbox)
      .values({
        to: message.to,
        from: message.from,
        content: message.content,
        contentSid: message.contentSid,
        contentVariables: message.contentVariables,
        mediaUrl: message.mediaUrl,
        status: "sent",
        sentAt,
      })
      .returning()) as { id: string }[];

    const inserted = rows[0];
    if (!inserted) {
      throw new Error("whatsapp outbox insert returned no rows");
    }

    return {
      status: "sent",
      providerMessageId: `outbox-${inserted.id}`,
      provider: this.name,
      timestamp: sentAt.toISOString(),
    };
  }
}
