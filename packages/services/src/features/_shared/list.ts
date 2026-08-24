import { asc, desc, type SQL, type SQLWrapper } from "drizzle-orm";
import { z } from "zod";

/**
 * Shared contract for the admin data-table list endpoints (the iterator sibling
 * of `filters.ts`). Every CRUD list extends `listQueryBase` with its own filter
 * keys; the repository builds a `where` from those, applies `buildOrderBy` from
 * a column whitelist, and paginates with offset. See `.claude/skills/data-table`.
 */

export const sortItemSchema = z.object({ id: z.string().max(40), desc: z.boolean() });
export type SortItem = z.infer<typeof sortItemSchema>;

export const listQueryBase = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(25),
  /** Multi-column sort, applied in order. Ids are validated against a
   *  per-feature whitelist in the repository (unknown ids are ignored). */
  sort: z.array(sortItemSchema).max(5).default([]),
});

export interface ListResult<T> {
  rows: T[];
  total: number;
  pageCount: number;
}

/** Order expressions from a sort spec, restricted to a column whitelist.
 *  Unknown ids are dropped; falls back to `fallback` when nothing valid. */
export function buildOrderBy(
  sort: SortItem[],
  columns: Record<string, SQLWrapper>,
  fallback: SQL[],
): SQL[] {
  const out: SQL[] = [];
  for (const s of sort) {
    const col = columns[s.id];
    if (col) out.push(s.desc ? desc(col) : asc(col));
  }
  return out.length > 0 ? out : fallback;
}

export const pageOffset = (page: number, perPage: number): number => (page - 1) * perPage;
export const pageCountOf = (total: number, perPage: number): number =>
  Math.max(1, Math.ceil(total / perPage));
