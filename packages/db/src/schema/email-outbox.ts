import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `email_outbox` — persistence target for the `outbox` provider in
 * `@saas/email`. Used in preview deploys so devs can review sent
 * messages via the dev outbox view and Playwright can fetch them via
 * `/api/email-outbox`. Not used in production (Resend is the provider
 * there; this table stays empty).
 *
 * Multi-recipient lists (`to`, `cc`, `bcc`) are stored comma-joined.
 * `metadata` carries `tags`, `headers`, `priority`, and a small
 * attachment summary (`{ filename, contentType, size }`) — the actual
 * attachment bytes are NOT persisted (use the folder transport for
 * full fidelity locally).
 *
 * See `.claude/skills/email/SKILL.md` for the full data flow.
 */
export const emailOutbox = sqliteTable(
  "email_outbox",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    to: text("to").notNull(),
    from: text("from"),
    replyTo: text("reply_to"),
    cc: text("cc"),
    bcc: text("bcc"),
    subject: text("subject").notNull(),
    html: text("html"),
    text: text("text"),
    status: text("status").notNull().default("sent"),
    providerMessageId: text("provider_message_id"),
    sentAt: integer("sent_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    metadata: text("metadata", { mode: "json" }),
  },
  (t) => ({
    toSentAtIdx: index("email_outbox_to_sent_at_idx").on(t.to, t.sentAt),
    sentAtIdx: index("email_outbox_sent_at_idx").on(t.sentAt),
  }),
);

export type EmailOutboxRow = typeof emailOutbox.$inferSelect;
export type EmailOutboxInsert = typeof emailOutbox.$inferInsert;
