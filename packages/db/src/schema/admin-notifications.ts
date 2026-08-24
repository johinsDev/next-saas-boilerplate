import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { organization, user } from "./auth";

/** Severity the inbox styles rows against (icon + tone). */
export const ADMIN_ALERT_SEVERITIES = [
  "info",
  "success",
  "warning",
  "critical",
] as const;
export type AdminAlertSeverity = (typeof ADMIN_ALERT_SEVERITIES)[number];

/** Entities an alert can deep-link to from its detail panel. */
export const ADMIN_ALERT_ENTITIES = [
  "user",
  "purchase",
  "campaign",
  "employee",
] as const;
export type AdminAlertEntity = (typeof ADMIN_ALERT_ENTITIES)[number];

/**
 * `admin_notification` — the operator-facing alert inbox ("what needs my
 * attention"), the counterpart to the user-facing `notification` feed.
 *
 * One row **per recipient**: the send job resolves the audience (role floor +
 * and fans the alert out, so read/archive state is naturally per-user. Rows are
 * never deleted by hand — `archivedAt` takes them out of the inbox and a cron
 * purges archived rows past the retention window. That keeps operational
 * evidence (manual adjustments, bans, impersonations) from being swept away by
 * whoever triggered it.
 *
 * in every scope. `data` carries the notification payload the detail panel
 * renders; `entityType`/`entityId` drive the "go to the thing" link.
 */
export const adminNotification = sqliteTable(
  "admin_notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Recipient — a staff `user`, not a user. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    severity: text("severity").notNull().$type<AdminAlertSeverity>(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: text("data", { mode: "json" }),
    entityType: text("entity_type").$type<AdminAlertEntity>(),
    entityId: text("entity_id"),
    /** Null until the recipient opens it. */
    readAt: integer("read_at", { mode: "timestamp" }),
    /** Null while it sits in the inbox. */
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    inboxIdx: index("admin_notification_inbox_idx").on(
      t.userId,
      t.organizationId,
      t.archivedAt,
      t.createdAt,
    ),
    unreadIdx: index("admin_notification_unread_idx").on(
      t.userId,
      t.organizationId,
      t.readAt,
    ),
  }),
);

export type AdminNotificationRow = typeof adminNotification.$inferSelect;
export type AdminNotificationInsert = typeof adminNotification.$inferInsert;
