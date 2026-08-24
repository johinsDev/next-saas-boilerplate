import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `whatsapp_outbox` — persistence target for the `outbox` provider in
 * `@saas/whatsapp`. Used in preview deploys so the PM can review
 * sent messages via the admin panel and Playwright can fetch them via
 * `/api/whatsapp-outbox`. Not used in production (Twilio is the
 * provider there; this table stays empty).
 *
 * See `.claude/skills/whatsapp/SKILL.md` for the full data flow.
 */
export const whatsappOutbox = sqliteTable(
  "whatsapp_outbox",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    to: text("to").notNull(),
    from: text("from"),
    content: text("content").notNull(),
    contentSid: text("content_sid"),
    contentVariables: text("content_variables", { mode: "json" }),
    mediaUrl: text("media_url"),
    status: text("status").notNull().default("sent"),
    providerMessageId: text("provider_message_id"),
    sentAt: integer("sent_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    metadata: text("metadata", { mode: "json" }),
  },
  (t) => ({
    toSentAtIdx: index("whatsapp_outbox_to_sent_at_idx").on(t.to, t.sentAt),
    sentAtIdx: index("whatsapp_outbox_sent_at_idx").on(t.sentAt),
  }),
);

export type WhatsappOutboxRow = typeof whatsappOutbox.$inferSelect;
export type WhatsappOutboxInsert = typeof whatsappOutbox.$inferInsert;
