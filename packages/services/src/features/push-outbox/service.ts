import type { PushOutboxRow } from "@saas/db/schema";
import { ServiceError } from "../_shared/errors";

import type { ListResult, PushOutboxRepository } from "./repository";
import type { LatestForRecipientInput, ListInput } from "./schemas";

/**
 * Thin pass-through today. Lives here so future business rules (mask
 * tokens for non-admins, hide failed sends from non-staff) have a
 * single home above the repository.
 */
export class PushOutboxService {
  constructor(private readonly repo: PushOutboxRepository) {}

  list(input: ListInput): Promise<ListResult> {
    return this.repo.list(input);
  }

  async get(id: string): Promise<PushOutboxRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new ServiceError({
        code: "NOT_FOUND",
        message: `push_outbox row "${id}" not found`,
      });
    }
    return row;
  }

  latestForRecipient(
    input: LatestForRecipientInput,
  ): Promise<PushOutboxRow[]> {
    return this.repo.latestForRecipient(input);
  }

  /**
   * Delete rows older than `olderThanDays`. Called by the daily
   * `prune-outboxes` Trigger.dev task.
   */
  prune(olderThanDays: number): Promise<number> {
    return this.repo.deleteOlderThan(olderThanDays);
  }
}
