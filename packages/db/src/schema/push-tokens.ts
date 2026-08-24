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
 * `push_token` — per-device push notification token registry. One row
 * per (user, organization, token) tuple. `platform` distinguishes
 * the wire protocol:
 *
 *   - `webpush`: `token` holds the JSON-serialized `PushSubscription`
 *     (browser-issued; includes `{ endpoint, keys: { p256dh, auth } }`)
 *   - `expo`: `token` holds the `ExponentPushToken[…]` string
 *
 * `isActive: false` is the soft-delete state used when a transport
 * returns `SubscriptionExpiredError` (HTTP 410 for web push,
 * `DeviceNotRegistered` for Expo) — keeps the row for audit while
 * preventing further sends.
 *
 * See `.claude/skills/push/SKILL.md` for the registration flow.
 */
export const pushToken = sqliteTable(
  "push_token",
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
    platform: text("platform").notNull(),
    token: text("token").notNull(),
    deviceLabel: text("device_label"),
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(true),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userOrgTokenUq: uniqueIndex("push_token_user_org_token_uq").on(
      t.userId,
      t.organizationId,
      t.token,
    ),
    userIdx: index("push_token_user_idx").on(t.userId),
    orgPlatformIdx: index("push_token_org_platform_idx").on(
      t.organizationId,
      t.platform,
    ),
  }),
);

export type PushTokenRow = typeof pushToken.$inferSelect;
export type PushTokenInsert = typeof pushToken.$inferInsert;
