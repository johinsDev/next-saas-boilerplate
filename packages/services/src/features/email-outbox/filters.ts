import { emailOutbox } from "@saas/db/schema";
import { eq, like, type SQL } from "drizzle-orm";

import { Filters } from "../_shared/filters";
import type { EmailOutboxStatus, ListInput } from "./schemas";

interface WhereChainable {
  where(condition: SQL): this;
}

/**
 * Concrete filter set for `email_outbox`. Add a new filter by:
 *   1. Adding the key + value type to `ListInput` (schemas.ts).
 *   2. Adding the key to `allowedFilters()`.
 *   3. Adding a protected method with the same name.
 */
export class EmailOutboxFilters<TBuilder extends WhereChainable> extends Filters<
  ListInput,
  TBuilder
> {
  protected allowedFilters(): readonly string[] {
    return ["to", "status", "search"] as const;
  }

  /**
   * Partial, case-insensitive recipient match. Lets devs find a
   * recipient by typing fragments of an email address or display
   * name — same UX as the SMS / WhatsApp filters.
   */
  protected to(value: string): void {
    this.builder = this.builder.where(like(emailOutbox.to, `%${value}%`));
  }

  protected status(value: EmailOutboxStatus): void {
    this.builder = this.builder.where(eq(emailOutbox.status, value));
  }

  /**
   * Free-text search over the subject. Body search would require a
   * `sql` expression union; defer until we have real volume / need.
   */
  protected search(value: string): void {
    this.builder = this.builder.where(like(emailOutbox.subject, `%${value}%`));
  }
}
