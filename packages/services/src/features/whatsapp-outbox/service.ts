import { ServiceError } from "../_shared/errors";
import type { WhatsappOutboxRow } from "@saas/db/schema";

import type {
  WhatsAppOutboxRepository,
  ListResult,
} from "./repository";
import type { ListInput, LatestForRecipientInput } from "./schemas";

/**
 * Thin pass-through today. Lives here so future business rules
 * (mask content for non-admins, enforce opt-in, hide failed sends
 * from non-staff) have a single home above the repository.
 */
export class WhatsAppOutboxService {
  constructor(private readonly repo: WhatsAppOutboxRepository) {}

  list(input: ListInput): Promise<ListResult> {
    return this.repo.list(input);
  }

  async get(id: string): Promise<WhatsappOutboxRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new ServiceError({
        code: "NOT_FOUND",
        message: `whatsapp_outbox row "${id}" not found`,
      });
    }
    return row;
  }

  latestForRecipient(input: LatestForRecipientInput): Promise<WhatsappOutboxRow[]> {
    return this.repo.latestForRecipient(input);
  }

  /**
   * Delete rows older than `olderThanDays`. Called by the daily
   * `prune-outboxes` Trigger.dev task in `packages/jobs/`. Returns
   * the row count for logging / observability.
   */
  prune(olderThanDays: number): Promise<number> {
    return this.repo.deleteOlderThan(olderThanDays);
  }
}
