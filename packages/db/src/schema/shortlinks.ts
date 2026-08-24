import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { organization, user } from "./auth";

/**
 * `shortlink` — slug → target URL map for the self-hosted shortener
 * (`@saas/shortlinks`, `custom` provider). The redirect endpoint
 * (the Cloudflare Worker, `apps/api`) resolves `slug` → `targetUrl` and
 * 302s. `clickCount` is denormalized for fast list display; the per-hit
 * detail lives in `shortlink_click`.
 *
 * Rows are org-scoped; `slug` is unique host-wide (the short domain is
 * shared across orgs). Programmatic `shorten(url)` dedupes on
 * `(organizationId, targetUrl)` among `active` rows so re-sending the
 * same campaign reuses one slug. `expiresAt` (nullable) + `active` gate
 * the redirect.
 *
 * See `.claude/skills/shortlinks/SKILL.md`.
 */
export const shortlink = sqliteTable(
  "shortlink",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text("slug").notNull(),
    targetUrl: text("target_url").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clickCount: integer("click_count").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // Per-recipient campaign attribution (plain columns, no FK — kept for the
    // "Clic" funnel even if the campaign/user is later removed). Set when a
    // campaign send mints a `{{short_link}}` for a specific recipient.
    campaignId: text("campaign_id"),
    recipientId: text("recipient_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
  },
  (t) => ({
    slugUq: uniqueIndex("shortlink_slug_uq").on(t.slug),
    orgTargetIdx: index("shortlink_org_target_idx").on(
      t.organizationId,
      t.targetUrl,
    ),
    orgCreatedIdx: index("shortlink_org_created_idx").on(
      t.organizationId,
      t.createdAt,
    ),
    // Powers the campaign "Clic" funnel (join clicks → shortlink by campaign).
    campaignIdx: index("shortlink_campaign_idx").on(t.campaignId),
  }),
);

/**
 * `shortlink_click` — one row per redirect hit. The geo (`country`,
 * `city`) comes free from Cloudflare's `request.cf` on the Worker; the
 * raw `userAgent` is stored unparsed (parse on read if needed). Written
 * via `executionCtx.waitUntil()` so it never blocks the 302.
 */
export const shortlinkClick = sqliteTable(
  "shortlink_click",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shortlinkId: text("shortlink_id")
      .notNull()
      .references(() => shortlink.id, { onDelete: "cascade" }),
    clickedAt: integer("clicked_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    country: text("country"),
    city: text("city"),
    userAgent: text("user_agent"),
    referer: text("referer"),
  },
  (t) => ({
    linkClickedIdx: index("shortlink_click_link_clicked_idx").on(
      t.shortlinkId,
      t.clickedAt,
    ),
  }),
);

export type ShortlinkRow = typeof shortlink.$inferSelect;
export type ShortlinkInsert = typeof shortlink.$inferInsert;
export type ShortlinkClickRow = typeof shortlinkClick.$inferSelect;
export type ShortlinkClickInsert = typeof shortlinkClick.$inferInsert;
