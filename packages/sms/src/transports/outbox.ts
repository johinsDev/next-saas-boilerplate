import { smsSegmentInfo } from "../schemas";
import type {
  OutboxProviderConfig,
  SmsMessageData,
  SmsResponse,
  SmsTransport,
} from "../types";

/**
 * Preview-deploy transport. Persists each send to `sms_outbox`
 * (Drizzle). Feeds the dev "SMS Outbox" view AND the
 * `/api/sms-outbox` endpoint that Playwright uses.
 *
 * The Drizzle `db` instance is injected via config so this package
 * stays free of an import-time DB dependency.
 *
 * Lazy-imports the schema to avoid loading `@saas/db` when the
 * outbox provider isn't selected.
 */
export class OutboxTransport implements SmsTransport {
  readonly name = "outbox";
  readonly #config: OutboxProviderConfig;

  constructor(config: OutboxProviderConfig) {
    this.#config = config;
  }

  async send(message: SmsMessageData): Promise<SmsResponse> {
    const dbSchema = (await import("@saas/db/schema")) as unknown as {
      smsOutbox: unknown;
    };
    const { smsOutbox } = dbSchema;

    const seg = smsSegmentInfo(message.content);
    const sentAt = new Date();
    const rows = (await this.#config.db
      .insert(smsOutbox)
      .values({
        to: message.to,
        from: message.from,
        content: message.content,
        encoding: seg.encoding,
        segments: seg.segments,
        characters: seg.characters,
        status: "sent",
        sentAt,
      })
      .returning()) as { id: string }[];

    const inserted = rows[0];
    if (!inserted) {
      throw new Error("sms outbox insert returned no rows");
    }

    return {
      status: "sent",
      providerMessageId: `outbox-${inserted.id}`,
      provider: this.name,
      timestamp: sentAt.toISOString(),
      segments: {
        encoding: seg.encoding,
        characters: seg.characters,
        count: seg.segments,
      },
    };
  }
}
