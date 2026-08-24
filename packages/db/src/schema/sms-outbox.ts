import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `sms_outbox` — persistence target for the `outbox` provider in
 * `@saas/sms`. Used in preview deploys so devs can review sent
 * messages via the dev outbox view and Playwright can fetch them via
 * `/api/sms-outbox`. Not used in production (Twilio is the provider
 * there; this table stays empty).
 *
 * `encoding`/`segments`/`characters` track carrier-billable segmentation
 * so the preview can surface "1 segment GSM-7" vs "3 segments UCS-2".
 *
 * See `.claude/skills/sms/SKILL.md` for the full data flow.
 */
export const smsOutbox = sqliteTable(
  "sms_outbox",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    to: text("to").notNull(),
    from: text("from"),
    content: text("content").notNull(),
    encoding: text("encoding").notNull().default("GSM-7"),
    segments: integer("segments").notNull().default(1),
    characters: integer("characters").notNull().default(0),
    status: text("status").notNull().default("sent"),
    providerMessageId: text("provider_message_id"),
    sentAt: integer("sent_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    metadata: text("metadata"),
  },
  (t) => ({
    toSentAtIdx: index("sms_outbox_to_sent_at_idx").on(t.to, t.sentAt),
    sentAtIdx: index("sms_outbox_sent_at_idx").on(t.sentAt),
  }),
);

export type SmsOutboxRow = typeof smsOutbox.$inferSelect;
export type SmsOutboxInsert = typeof smsOutbox.$inferInsert;
