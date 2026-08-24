import { smsOutbox } from "@saas/db/schema";
import { eq, like, type SQL } from "drizzle-orm";

import { Filters } from "../_shared/filters";
import type { ListInput, SmsOutboxStatus } from "./schemas";

interface WhereChainable {
  where(condition: SQL): this;
}

/**
 * Concrete filter set for `sms_outbox`. Add a new filter by:
 *   1. Adding the key + value type to `ListInput` (schemas.ts).
 *   2. Adding the key to `allowedFilters()`.
 *   3. Adding a protected method with the same name.
 */
export class SmsOutboxFilters<TBuilder extends WhereChainable> extends Filters<
  ListInput,
  TBuilder
> {
  protected allowedFilters(): readonly string[] {
    return ["to", "status", "search"] as const;
  }

  /**
   * Partial, case-insensitive phone match — same UX as the WhatsApp
   * outbox filter (typing a country code matches every recipient that
   * contains it).
   */
  protected to(value: string): void {
    this.builder = this.builder.where(like(smsOutbox.to, `%${value}%`));
  }

  protected status(value: SmsOutboxStatus): void {
    this.builder = this.builder.where(eq(smsOutbox.status, value));
  }

  protected search(value: string): void {
    this.builder = this.builder.where(like(smsOutbox.content, `%${value}%`));
  }
}
