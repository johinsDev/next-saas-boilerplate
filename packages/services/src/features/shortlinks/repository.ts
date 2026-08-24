import type { db as Db } from "@saas/db";
import {
  shortlink,
  shortlinkClick,
  type ShortlinkRow,
} from "@saas/db/schema";
import { and, desc, eq, gt, like, or, sql } from "drizzle-orm";

import type { ListInput } from "./schemas";

export interface ListResult {
  rows: ShortlinkRow[];
  total: number;
}

/** Minimal slug→target resolution used by the redirect endpoint. */
export interface ResolvedLink {
  id: string;
  targetUrl: string;
}

export interface ClicksByDay {
  day: string;
  clicks: number;
}

export interface CountryCount {
  country: string;
  clicks: number;
}

/**
 * Drizzle access for `shortlink` + `shortlink_click`. Only layer that
 * touches the db. Used by the API feature (CRUD + analytics), the
 * redirect endpoint (`findActiveBySlug` + `recordClick`), and the
 * `custom` provider's store adapter (`findActiveByTarget`/`slugExists`/
 * `create`).
 */
export class ShortlinkRepository {
  constructor(private readonly db: typeof Db) {}

  async create(input: {
    slug: string;
    targetUrl: string;
    organizationId: string;
    expiresAt?: Date;
    createdByUserId?: string;
    campaignId?: string;
    recipientId?: string;
  }): Promise<ShortlinkRow> {
    const rows = await this.db
      .insert(shortlink)
      .values({
        slug: input.slug,
        targetUrl: input.targetUrl,
        organizationId: input.organizationId,
        expiresAt: input.expiresAt,
        createdByUserId: input.createdByUserId,
        campaignId: input.campaignId,
        recipientId: input.recipientId,
      })
      .returning();
    return rows[0] as ShortlinkRow;
  }

  async slugExists(slug: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: shortlink.id })
      .from(shortlink)
      .where(eq(shortlink.slug, slug))
      .limit(1);
    return rows.length > 0;
  }

  /** Active slug for this (org, target) — powers dedupe. */
  async findActiveByTarget(
    organizationId: string,
    targetUrl: string,
  ): Promise<{ slug: string } | null> {
    const rows = await this.db
      .select({ slug: shortlink.slug })
      .from(shortlink)
      .where(
        and(
          eq(shortlink.organizationId, organizationId),
          eq(shortlink.targetUrl, targetUrl),
          eq(shortlink.active, true),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  /** For the redirect: returns the target only when active + not expired. */
  async findActiveBySlug(slug: string): Promise<ResolvedLink | null> {
    const rows = await this.db
      .select({
        id: shortlink.id,
        targetUrl: shortlink.targetUrl,
        active: shortlink.active,
        expiresAt: shortlink.expiresAt,
      })
      .from(shortlink)
      .where(eq(shortlink.slug, slug))
      .limit(1);
    const row = rows[0];
    if (!row || !row.active) return null;
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
    return { id: row.id, targetUrl: row.targetUrl };
  }

  /** Insert a click row + bump the denormalized count. */
  async recordClick(input: {
    shortlinkId: string;
    country?: string;
    city?: string;
    userAgent?: string;
    referer?: string;
  }): Promise<void> {
    await this.db.insert(shortlinkClick).values(input);
    await this.db
      .update(shortlink)
      .set({ clickCount: sql`${shortlink.clickCount} + 1` })
      .where(eq(shortlink.id, input.shortlinkId));
  }

  async list(organizationId: string, input: ListInput): Promise<ListResult> {
    const offset = (input.page - 1) * input.pageSize;
    const where = input.search
      ? and(
          eq(shortlink.organizationId, organizationId),
          or(
            like(shortlink.slug, `%${input.search}%`),
            like(shortlink.targetUrl, `%${input.search}%`),
          ),
        )
      : eq(shortlink.organizationId, organizationId);

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(shortlink)
        .where(where)
        .orderBy(desc(shortlink.createdAt))
        .limit(input.pageSize)
        .offset(offset),
      this.db.select({ value: sql<number>`count(*)` }).from(shortlink).where(where),
    ]);
    return { rows, total: countRows[0]?.value ?? 0 };
  }

  async findBySlug(
    organizationId: string,
    slug: string,
  ): Promise<ShortlinkRow | null> {
    const rows = await this.db
      .select()
      .from(shortlink)
      .where(
        and(
          eq(shortlink.slug, slug),
          eq(shortlink.organizationId, organizationId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<ShortlinkRow | null> {
    const rows = await this.db
      .select()
      .from(shortlink)
      .where(
        and(eq(shortlink.id, id), eq(shortlink.organizationId, organizationId)),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async deactivate(organizationId: string, id: string): Promise<void> {
    await this.db
      .update(shortlink)
      .set({ active: false })
      .where(
        and(eq(shortlink.id, id), eq(shortlink.organizationId, organizationId)),
      );
  }

  /** Clicks per day for the last `sinceDays` (UTC), for the detail chart. */
  async clicksByDay(
    shortlinkId: string,
    sinceDays: number,
  ): Promise<ClicksByDay[]> {
    const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const day = sql<string>`strftime('%Y-%m-%d', ${shortlinkClick.clickedAt}, 'unixepoch')`;
    return this.db
      .select({ day, clicks: sql<number>`count(*)` })
      .from(shortlinkClick)
      .where(
        and(
          eq(shortlinkClick.shortlinkId, shortlinkId),
          gt(shortlinkClick.clickedAt, cutoff),
        ),
      )
      .groupBy(day)
      .orderBy(day);
  }

  /** Top countries for a link (nulls excluded). */
  async topCountries(
    shortlinkId: string,
    limit: number,
  ): Promise<CountryCount[]> {
    return this.db
      .select({
        country: sql<string>`${shortlinkClick.country}`,
        clicks: sql<number>`count(*)`,
      })
      .from(shortlinkClick)
      .where(
        and(
          eq(shortlinkClick.shortlinkId, shortlinkId),
          sql`${shortlinkClick.country} is not null`,
        ),
      )
      .groupBy(shortlinkClick.country)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
  }
}
