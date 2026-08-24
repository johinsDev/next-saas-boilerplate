import type { db as Db } from "@saas/db";
import { pushOutbox, type PushOutboxRow } from "@saas/db/schema";
import { desc, eq, lt, sql } from "drizzle-orm";

import { PushOutboxFilters } from "./filters";
import type { LatestForRecipientInput, ListInput } from "./schemas";

export interface ListResult {
  rows: PushOutboxRow[];
  total: number;
}

/**
 * Drizzle access for `push_outbox`. The only layer in this feature
 * that touches the db; everything above goes through here.
 */
export class PushOutboxRepository {
  constructor(private readonly db: typeof Db) {}

  async list(input: ListInput): Promise<ListResult> {
    const offset = (input.page - 1) * input.pageSize;

    const baseRows = this.db.select().from(pushOutbox).$dynamic();
    const filteredRows = new PushOutboxFilters(baseRows, input).apply();
    const rows = (await filteredRows
      .orderBy(desc(pushOutbox.sentAt))
      .limit(input.pageSize)
      .offset(offset)) as PushOutboxRow[];

    const baseCount = this.db
      .select({ value: sql<number>`count(*)` })
      .from(pushOutbox)
      .$dynamic();
    const filteredCount = new PushOutboxFilters(baseCount, input).apply();
    const countRows = await filteredCount;
    const total = countRows[0]?.value ?? 0;

    return { rows, total };
  }

  async findById(id: string): Promise<PushOutboxRow | null> {
    const rows = await this.db
      .select()
      .from(pushOutbox)
      .where(eq(pushOutbox.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async latestForRecipient(
    input: LatestForRecipientInput,
  ): Promise<PushOutboxRow[]> {
    return this.db
      .select()
      .from(pushOutbox)
      .where(eq(pushOutbox.deviceToken, input.deviceToken))
      .orderBy(desc(pushOutbox.sentAt))
      .limit(input.limit);
  }

  /**
   * Delete rows older than `olderThanDays`. Used by the daily
   * `prune-outboxes` Trigger.dev task.
   */
  async deleteOlderThan(olderThanDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await this.db
      .delete(pushOutbox)
      .where(lt(pushOutbox.sentAt, cutoff));
    return result.rowsAffected;
  }
}
