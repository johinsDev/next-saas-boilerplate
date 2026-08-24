import { whatsappOutbox } from "@saas/db/schema";
import { eq, like, type SQL } from "drizzle-orm";

import { Filters } from "../_shared/filters";
import type { ListInput, WhatsAppOutboxStatus } from "./schemas";

/**
 * Builder shape Drizzle's `db.select(...).from(...)` exposes: chainable
 * `where(cond)` returning the same shape. Kept structural so we don't
 * pin to a single Drizzle return type that changes between versions.
 */
interface WhereChainable {
  where(condition: SQL): this;
}

/**
 * Concrete filter set for `whatsapp_outbox`. Add a new filter by:
 *   1. Adding the key + value type to `ListInput` (schemas.ts).
 *   2. Adding the key to `allowedFilters()`.
 *   3. Adding a protected method with the same name.
 */
export class WhatsAppOutboxFilters<TBuilder extends WhereChainable> extends Filters<
  ListInput,
  TBuilder
> {
  protected allowedFilters(): readonly string[] {
    return ["to", "status", "search"] as const;
  }

  /**
   * Partial, case-insensitive phone match. Users typing the area code
   * (`+5491155`) should see every recipient that starts with it, not
   * just exact-match rows. SQLite's `LIKE` is case-insensitive for ASCII.
   */
  protected to(value: string): void {
    this.builder = this.builder.where(like(whatsappOutbox.to, `%${value}%`));
  }

  protected status(value: WhatsAppOutboxStatus): void {
    this.builder = this.builder.where(eq(whatsappOutbox.status, value));
  }

  protected search(value: string): void {
    this.builder = this.builder.where(like(whatsappOutbox.content, `%${value}%`));
  }
}
