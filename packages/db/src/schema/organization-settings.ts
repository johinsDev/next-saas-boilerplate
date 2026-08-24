import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { organization } from "./auth";

/** Brand social links. Only the filled keys are rendered. */
export type SocialLinks = {
  website?: string;
  instagram?: string;
  facebook?: string;
  x?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
};

/**
 * Per-organization configuration, 1:1 with the org row.
 *
 * `name` and `logo` stay on `organization`; everything an admin edits under
 * Settings lives here. Keep this table to configuration — anything with its own
 * lifecycle (plans, invoices, feature entitlements) wants its own table.
 */
export const organizationSettings = sqliteTable(
  "organization_settings",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Localization
    defaultLocale: text("default_locale").notNull().default("en"),
    supportedLocales: text("supported_locales", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'["en"]'`),
    currency: text("currency").notNull().default("USD"),
    timezone: text("timezone").notNull().default("UTC"),

    // Brand
    description: text("description"),
    primaryColor: text("primary_color"),
    social: text("social", { mode: "json" }).$type<SocialLinks>(),
    termsUrl: text("terms_url"),
    privacyUrl: text("privacy_url"),

    // SEO
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    seoImageUrl: text("seo_image_url"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    organizationIdx: index("organization_settings_organization_idx").on(t.organizationId),
  }),
);

export const organizationSettingsRelations = relations(organizationSettings, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationSettings.organizationId],
    references: [organization.id],
  }),
}));

export type OrganizationSettingsRow = typeof organizationSettings.$inferSelect;
export type OrganizationSettingsInsert = typeof organizationSettings.$inferInsert;
