import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { organization, user } from "./auth";

/**
 * Known audit event types. Auth events (login/logout) are written by the Better
 * Auth session hooks; admin events by the employees service. Domain events
 * (venta/sello/canje) are NOT stored here — they're derived from the
 * domain tables and merged into the activity feed at read
 * time (see the employees feature's `activity`).
 */
export const AUDIT_TYPES = [
  "login",
  "logout",
  "invite_sent",
  "invite_accepted",
  "role_change",
  "disable",
  "enable",
  "delete",
  "restore",
  "email_change",
  "rating_change",
  "stores_change",
  "impersonation_start",
  "impersonation_stop",
  "session_revoke",
  // User (CRM) admin actions.
  "user_create",
  "user_update",
  "customer_ban",
  "customer_unban",
  "customer_points_adjust",
  "customer_stamps_adjust",
] as const;

export type AuditType = (typeof AUDIT_TYPES)[number];

/**
 * `audit_log` — append-only trail of auth + admin actions. `actorUserId` is who
 * did it (null for system/self events like a plain login), `targetUserId` is the
 * employee/user affected (the activity feed filters on it). `metadata` holds
 * event-specific detail (old/new email, role, store ids, ip, session id…).
 */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    targetUserId: text("target_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull().$type<AuditType>(),
    metadata: text("metadata", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byTarget: index("audit_log_target_idx").on(
      t.organizationId,
      t.targetUserId,
      t.createdAt,
    ),
    byActor: index("audit_log_actor_idx").on(t.actorUserId, t.createdAt),
  }),
);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  organization: one(organization, {
    fields: [auditLog.organizationId],
    references: [organization.id],
  }),
  actor: one(user, {
    fields: [auditLog.actorUserId],
    references: [user.id],
    relationName: "auditActor",
  }),
  target: one(user, {
    fields: [auditLog.targetUserId],
    references: [user.id],
    relationName: "auditTarget",
  }),
}));

export type AuditLogRow = typeof auditLog.$inferSelect;
export type AuditLogInsert = typeof auditLog.$inferInsert;
