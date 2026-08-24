import type { db as Db } from "@saas/db";
import { whatsappOutbox, type WhatsappOutboxRow } from "@saas/db/schema";
import { desc, eq, lt, sql } from "drizzle-orm";

import { WhatsAppOutboxFilters } from "./filters";
import type { ListInput, LatestForRecipientInput } from "./schemas";

export interface ListResult {
  rows: WhatsappOutboxRow[];
  total: number;
}

/**
 * Drizzle access for `whatsapp_outbox`. The only layer in this feature
 * that touches the db; everything above goes through here.
 */
export class WhatsAppOutboxRepository {
  constructor(private readonly db: typeof Db) {}

  async list(input: ListInput): Promise<ListResult> {
    const offset = (input.page - 1) * input.pageSize;

    const baseRows = this.db.select().from(whatsappOutbox).$dynamic();
    const filteredRows = new WhatsAppOutboxFilters(baseRows, input).apply();
    const rows = (await filteredRows
      .orderBy(desc(whatsappOutbox.sentAt))
      .limit(input.pageSize)
      .offset(offset)) as WhatsappOutboxRow[];

    const baseCount = this.db
      .select({ value: sql<number>`count(*)` })
      .from(whatsappOutbox)
      .$dynamic();
    const filteredCount = new WhatsAppOutboxFilters(baseCount, input).apply();
    const countRows = await filteredCount;
    const total = countRows[0]?.value ?? 0;

    return { rows, total };
  }

  async findById(id: string): Promise<WhatsappOutboxRow | null> {
    const rows = await this.db
      .select()
      .from(whatsappOutbox)
      .where(eq(whatsappOutbox.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async latestForRecipient(
    input: LatestForRecipientInput,
  ): Promise<WhatsappOutboxRow[]> {
    return this.db
      .select()
      .from(whatsappOutbox)
      .where(eq(whatsappOutbox.to, input.to))
      .orderBy(desc(whatsappOutbox.sentAt))
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
      .delete(whatsappOutbox)
      .where(lt(whatsappOutbox.sentAt, cutoff));
    return result.rowsAffected;
  }
}
