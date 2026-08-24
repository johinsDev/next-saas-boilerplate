import type {
  OutboxProviderConfig,
  PushMessageData,
  PushResponse,
  PushTransport,
  ResolvedRecipient,
} from "../types";

/**
 * Preview-deploy transport. Persists each send to `push_outbox`
 * (Drizzle). Feeds the dev "Push Outbox" view AND the
 * `/api/push-outbox` endpoint that Playwright uses.
 *
 * The Drizzle `db` instance is injected via config so this package
 * stays free of an import-time DB dependency.
 *
 * Lazy-imports the schema to avoid loading `@saas/db` when the
 * outbox provider isn't selected.
 */
export class OutboxTransport implements PushTransport {
  readonly name = "outbox";
  readonly #config: OutboxProviderConfig;

  constructor(config: OutboxProviderConfig) {
    this.#config = config;
  }

  async send(
    message: PushMessageData,
    recipient: ResolvedRecipient,
  ): Promise<PushResponse> {
    const dbSchema = (await import("@saas/db/schema")) as unknown as {
      pushOutbox: unknown;
    };
    const { pushOutbox } = dbSchema;

    const sentAt = new Date();

    const rows = (await this.#config.db
      .insert(pushOutbox)
      .values({
        deviceToken: recipient.token,
        platform: recipient.platform,
        title: message.title,
        body: message.body,
        data: message.data ?? null,
        status: "sent",
        sentAt,
        metadata: {
          ...(message.badge !== undefined && { badge: message.badge }),
          ...(message.icon && { icon: message.icon }),
          ...(message.image && { image: message.image }),
          ...(message.sound && { sound: message.sound }),
          ...(message.clickAction && { clickAction: message.clickAction }),
          ...(message.ttl !== undefined && { ttl: message.ttl }),
          ...(message.priority && { priority: message.priority }),
        },
      })
      .returning()) as { id: string }[];

    const inserted = rows[0];
    if (!inserted) {
      throw new Error("push outbox insert returned no rows");
    }

    return {
      status: "sent",
      providerMessageId: `outbox-${inserted.id}`,
      provider: this.name,
      platform: recipient.platform,
      token: recipient.token,
      timestamp: sentAt.toISOString(),
    };
  }
}
