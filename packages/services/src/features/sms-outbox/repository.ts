import type { db as Db } from "@saas/db";
import { smsOutbox, type SmsOutboxRow } from "@saas/db/schema";
import { desc, eq, lt, sql } from "drizzle-orm";

import { SmsOutboxFilters } from "./filters";
import type { LatestForRecipientInput, ListInput } from "./schemas";

export interface ListResult {
  rows: SmsOutboxRow[];
  total: number;
}

/**
 * Drizzle access for `sms_outbox`. The only layer in this feature
 * that touches the db; everything above goes through here.
 */
export class SmsOutboxRepository {
  constructor(private readonly db: typeof Db) {}

  async list(input: ListInput): Promise<ListResult> {
    const offset = (input.page - 1) * input.pageSize;

    const baseRows = this.db.select().from(smsOutbox).$dynamic();
    const filteredRows = new SmsOutboxFilters(baseRows, input).apply();
    const rows = (await filteredRows
      .orderBy(desc(smsOutbox.sentAt))
      .limit(input.pageSize)
      .offset(offset)) as SmsOutboxRow[];

    const baseCount = this.db
      .select({ value: sql<number>`count(*)` })
      .from(smsOutbox)
      .$dynamic();
    const filteredCount = new SmsOutboxFilters(baseCount, input).apply();
    const countRows = await filteredCount;
    const total = countRows[0]?.value ?? 0;

    return { rows, total };
  }

  async findById(id: string): Promise<SmsOutboxRow | null> {
    const rows = await this.db
      .select()
      .from(smsOutbox)
      .where(eq(smsOutbox.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async latestForRecipient(
    input: LatestForRecipientInput,
  ): Promise<SmsOutboxRow[]> {
    return this.db
      .select()
      .from(smsOutbox)
      .where(eq(smsOutbox.to, input.to))
      .orderBy(desc(smsOutbox.sentAt))
      .limit(input.limit);
  }

  /**
   * Delete rows older than `olderThanDays`. Used by the daily
   * `prune-outboxes` Trigger.dev task. Returns the row count for
   * observability.
   */
  async deleteOlderThan(olderThanDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await this.db
      .delete(smsOutbox)
      .where(lt(smsOutbox.sentAt, cutoff));
    return result.rowsAffected;
  }
}
