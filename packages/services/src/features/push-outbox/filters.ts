import { pushOutbox } from "@saas/db/schema";
import { eq, like, type SQL } from "drizzle-orm";

import { Filters } from "../_shared/filters";
import type {
  ListInput,
  PushOutboxStatus,
  PushPlatformInput,
} from "./schemas";

interface WhereChainable {
  where(condition: SQL): this;
}

/**
 * Concrete filter set for `push_outbox`. Add a new filter by:
 *   1. Adding the key + value type to `ListInput` (schemas.ts).
 *   2. Adding the key to `allowedFilters()`.
 *   3. Adding a protected method with the same name.
 */
export class PushOutboxFilters<TBuilder extends WhereChainable> extends Filters<
  ListInput,
  TBuilder
> {
  protected allowedFilters(): readonly string[] {
    return ["deviceToken", "platform", "status", "search"] as const;
  }

  /**
   * Partial, case-insensitive token match. Lets devs find a device
   * by typing a fragment of an Expo token or web push endpoint URL.
   */
  protected deviceToken(value: string): void {
    this.builder = this.builder.where(
      like(pushOutbox.deviceToken, `%${value}%`),
    );
  }

  protected platform(value: PushPlatformInput): void {
    this.builder = this.builder.where(eq(pushOutbox.platform, value));
  }

  protected status(value: PushOutboxStatus): void {
    this.builder = this.builder.where(eq(pushOutbox.status, value));
  }

  /**
   * Free-text search over the title. Body would push the index off
   * the hot path; titles are the high-signal field for filtering.
   */
  protected search(value: string): void {
    this.builder = this.builder.where(like(pushOutbox.title, `%${value}%`));
  }
}
