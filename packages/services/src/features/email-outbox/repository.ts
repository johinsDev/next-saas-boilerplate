import type { db as Db } from "@saas/db";
import { emailOutbox, type EmailOutboxRow } from "@saas/db/schema";
import { desc, eq, lt, sql } from "drizzle-orm";

import { EmailOutboxFilters } from "./filters";
import type { LatestForRecipientInput, ListInput } from "./schemas";

export interface ListResult {
  rows: EmailOutboxRow[];
  total: number;
}

/**
 * Drizzle access for `email_outbox`. The only layer in this feature
 * that touches the db; everything above goes through here.
 */
export class EmailOutboxRepository {
  constructor(private readonly db: typeof Db) {}

  async list(input: ListInput): Promise<ListResult> {
    const offset = (input.page - 1) * input.pageSize;

    const baseRows = this.db.select().from(emailOutbox).$dynamic();
    const filteredRows = new EmailOutboxFilters(baseRows, input).apply();
    const rows = (await filteredRows
      .orderBy(desc(emailOutbox.sentAt))
      .limit(input.pageSize)
      .offset(offset)) as EmailOutboxRow[];

    const baseCount = this.db
      .select({ value: sql<number>`count(*)` })
      .from(emailOutbox)
      .$dynamic();
    const filteredCount = new EmailOutboxFilters(baseCount, input).apply();
    const countRows = await filteredCount;
    const total = countRows[0]?.value ?? 0;

    return { rows, total };
  }

  async findById(id: string): Promise<EmailOutboxRow | null> {
    const rows = await this.db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async latestForRecipient(
    input: LatestForRecipientInput,
  ): Promise<EmailOutboxRow[]> {
    return this.db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.to, input.to))
      .orderBy(desc(emailOutbox.sentAt))
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
      .delete(emailOutbox)
      .where(lt(emailOutbox.sentAt, cutoff));
    return result.rowsAffected;
  }
}
