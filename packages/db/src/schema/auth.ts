import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: integer("phone_number_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  // Better Auth `admin` plugin columns. NOTE: `user.role` here is ONLY the
  // admin-plugin capability flag (admin vs user) that gates impersonation /
  // ban / list-sessions — it is NOT the app's authorization role. The canonical
  // operator role lives on `member.role` (see @saas/auth roles.ts). Only the
  // owner carries `role: "admin"` so they can call the admin-plugin endpoints.
  role: text("role"),
  // `banned` is the "Inhabilitado" toggle: blocks sign-in + lets us revoke
  // sessions, while keeping the employee visible/reversible.
  banned: integer("banned", { mode: "boolean" }),
  banReason: text("ban_reason"),
  banExpires: integer("ban_expires", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
    // Better Auth `admin` plugin: set to the impersonator's user id while an
    // impersonation session is active. The impersonation banner keys off it.
    impersonatedBy: text("impersonated_by"),
  },
  (t) => ({
    // Listing/revoking a user's sessions scans by user_id; `token` already has
    // a unique index from the column definition.
    userIdIdx: index("session_user_id_idx").on(t.userId),
  }),
);

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const organization = sqliteTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  metadata: text("metadata"),
});

export const member = sqliteTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    // Employee-management fields (the admin "Empleados" feature). Owner-set
    // performance rating (1–5) + free-text notes; `deletedAt` is the soft-delete
    // marker (the user row is kept for audit/stats history).
    rating: integer("rating"),
    notes: text("notes"),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    // `getUserRole` reads by user_id on every role-gated procedure.
    userIdIdx: index("member_user_id_idx").on(t.userId),
    // Roster reads (Empleados list, leaderboard) scan by org.
    organizationIdIdx: index("member_organization_id_idx").on(t.organizationId),
  }),
);

export const invitation = sqliteTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull().default("pending"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Store ids chosen at invite time (JSON array). Applied to `store_staff` by
  // the org plugin's invitation-accept hook once the member row exists.
  assignedStoreIds: text("assigned_store_ids", { mode: "json" }).$type<
    string[]
  >(),
});

export type UserRow = typeof user.$inferSelect;
export type SessionRow = typeof session.$inferSelect;
export type MemberRow = typeof member.$inferSelect;
export type InvitationRow = typeof invitation.$inferSelect;
