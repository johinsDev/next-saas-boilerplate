import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `push_outbox` — persistence target for the `outbox` provider in
 * `@saas/push`. Used in preview deploys so devs/PMs can review
 * sent push notifications via the dev outbox view and Playwright can
 * fetch them via `/api/push-outbox`. Not used in production
 * (`auto` / `webpush` / `expo` providers ship to the real services
 * there; this table stays empty).
 *
 * `deviceToken` holds either a JSON-stringified `PushSubscription`
 * (for `platform === "webpush"`) or an `ExponentPushToken[…]` string
 * (for `platform === "expo"`).
 *
 * `metadata` carries `badge`, `icon`, `image`, `sound`, `clickAction`,
 * `ttl`, `priority` — anything beyond the visible title + body lands
 * here so the dev view can render the full payload.
 *
 * See `.claude/skills/push/SKILL.md` for the full data flow.
 */
export const pushOutbox = sqliteTable(
  "push_outbox",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    deviceToken: text("device_token").notNull(),
    platform: text("platform").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: text("data", { mode: "json" }),
    status: text("status").notNull().default("sent"),
    providerMessageId: text("provider_message_id"),
    sentAt: integer("sent_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    metadata: text("metadata", { mode: "json" }),
  },
  (t) => ({
    deviceTokenSentAtIdx: index("push_outbox_device_token_sent_at_idx").on(
      t.deviceToken,
      t.sentAt,
    ),
    sentAtIdx: index("push_outbox_sent_at_idx").on(t.sentAt),
  }),
);

export type PushOutboxRow = typeof pushOutbox.$inferSelect;
export type PushOutboxInsert = typeof pushOutbox.$inferInsert;
