import type { EmailOutboxRow } from "@saas/db/schema";
import { ServiceError } from "../_shared/errors";

import type { EmailOutboxRepository, ListResult } from "./repository";
import type { LatestForRecipientInput, ListInput } from "./schemas";

/**
 * Thin pass-through today. Lives here so future business rules
 * (mask body for non-admins, enforce compliance redaction, hide
 * failed sends from non-staff) have a single home above the
 * repository.
 */
export class EmailOutboxService {
  constructor(private readonly repo: EmailOutboxRepository) {}

  list(input: ListInput): Promise<ListResult> {
    return this.repo.list(input);
  }

  async get(id: string): Promise<EmailOutboxRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new ServiceError({
        code: "NOT_FOUND",
        message: `email_outbox row "${id}" not found`,
      });
    }
    return row;
  }

  latestForRecipient(
    input: LatestForRecipientInput,
  ): Promise<EmailOutboxRow[]> {
    return this.repo.latestForRecipient(input);
  }

  /**
   * Delete rows older than `olderThanDays`. Called by the daily
   * `prune-outboxes` Trigger.dev task. Returns the row count for
   * logging / observability.
   */
  prune(olderThanDays: number): Promise<number> {
    return this.repo.deleteOlderThan(olderThanDays);
  }
}
