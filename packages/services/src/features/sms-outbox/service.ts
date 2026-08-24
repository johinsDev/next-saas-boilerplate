import type { SmsOutboxRow } from "@saas/db/schema";
import { ServiceError } from "../_shared/errors";

import type {
  ListResult,
  SmsOutboxRepository,
} from "./repository";
import type { LatestForRecipientInput, ListInput } from "./schemas";

/**
 * Thin pass-through today. Lives here so future business rules
 * (mask content for non-admins, enforce opt-out, hide failed sends
 * from non-staff) have a single home above the repository.
 */
export class SmsOutboxService {
  constructor(private readonly repo: SmsOutboxRepository) {}

  list(input: ListInput): Promise<ListResult> {
    return this.repo.list(input);
  }

  async get(id: string): Promise<SmsOutboxRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new ServiceError({
        code: "NOT_FOUND",
        message: `sms_outbox row "${id}" not found`,
      });
    }
    return row;
  }

  latestForRecipient(
    input: LatestForRecipientInput,
  ): Promise<SmsOutboxRow[]> {
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
