import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { organization } from "./auth";
import { user } from "./auth";

/**
 * `notification` — the in-app feed and the persistence target for the
 * `database` channel in `@saas/notifications`. Every notification sent on
 * the `database` channel writes a row here so the user can read it later
 * (and mark it read). `category` is stored so the feed can style marketing vs
 * transactional. See `.claude/skills/notifications/SKILL.md`.
 */
export const notification = sqliteTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Discriminator the UI renders against (e.g. `welcome`, `promo`). */
    type: text("type").notNull(),
    /** `marketing` | `transactional` | `otp` | … (from the Notification). */
    category: text("category").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: text("data", { mode: "json" }),
    /** Null until the user opens it. */
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    feedIdx: index("notification_feed_idx").on(
      t.userId,
      t.organizationId,
      t.readAt,
    ),
    createdAtIdx: index("notification_created_at_idx").on(
      t.userId,
      t.createdAt,
    ),
  }),
);

export type NotificationRow = typeof notification.$inferSelect;
export type NotificationInsert = typeof notification.$inferInsert;

/**
 * `notification_preference` — per-channel marketing opt-out. One row per
 * `(user, organization, channel)`. **Absence of a row means subscribed**;
 * a row with `marketingEnabled = false` means the user opted out of
 * marketing on that channel. Transactional / OTP notifications ignore this
 * table entirely (they always send).
 */
export const notificationPreference = sqliteTable(
  "notification_preference",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** `mail` | `sms` | `push` | `whatsapp` | `realtime` | `database`. */
    channel: text("channel").notNull(),
    marketingEnabled: integer("marketing_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userOrgChannelUq: uniqueIndex(
      "notification_preference_user_org_channel_uq",
    ).on(t.userId, t.organizationId, t.channel),
  }),
);

export type NotificationPreferenceRow =
  typeof notificationPreference.$inferSelect;
export type NotificationPreferenceInsert =
  typeof notificationPreference.$inferInsert;

/**
 * `notification_config` — per-org override for an automated notification trigger
 * (keyed by `notificationKey`). Replaces the hardcoded `via()` channel set when
 * present: `enabled = false` suppresses the trigger entirely; `channels` (when
 * non-null) restricts delivery to that subset. Absence of a row = the code
 * defaults. Protected/security triggers (OTP, phone-change) ignore this table.
 */
export const notificationConfig = sqliteTable(
  "notification_config",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    notificationKey: text("notification_key").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    /** Channel allowlist override; null = use the notification's declared channels. */
    channels: text("channels", { mode: "json" }).$type<string[]>(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    orgKeyUq: uniqueIndex("notification_config_org_key_uq").on(
      t.organizationId,
      t.notificationKey,
    ),
  }),
);

export type NotificationConfigRow = typeof notificationConfig.$inferSelect;
export type NotificationConfigInsert = typeof notificationConfig.$inferInsert;
