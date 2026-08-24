import { normalizeContract } from "../messages/base-channel-message";
import type { DatabaseContract } from "../messages/contracts";
import type { Notification, NotificationRenderers } from "../notification";
import type {
  ChannelResult,
  NotificationCategory,
  ResolvedNotifiable,
} from "../types";
import type { NotificationChannel } from "./channel";

/** Row the database channel persists. The concrete repo lives app-side. */
export interface DatabaseNotificationInput {
  customerId: string;
  organizationId: string;
  type: string;
  title: string;
  body: string;
  category: NotificationCategory;
  data?: Record<string, unknown>;
}

/** Row the admin inbox persists, one per staff recipient. */
export interface AdminDatabaseNotificationInput {
  userId: string;
  organizationId: string;
  /** Null = org-wide (shows in every store scope). */
  storeId: string | null;
  type: string;
  severity: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
}

/**
 * Persists in-app notifications so they can be read / marked-read later. The
 * concrete Drizzle implementation lives in the app/jobs bootstrap.
 */
export interface DatabaseNotificationRepository {
  create(input: DatabaseNotificationInput): Promise<{ id: string }>;
}

/** Same, for the operator-facing `admin_notification` inbox. */
export interface AdminDatabaseNotificationRepository {
  create(input: AdminDatabaseNotificationInput): Promise<{ id: string }>;
}

/**
 * Writes the notification to the in-app feed. Unlike the other channels this
 * does not wrap a `@saas/*` transport — it persists via an injected repo.
 * The notification's `category` is propagated automatically (authors don't
 * repeat it in the contract).
 *
 * Two feeds live behind one channel because they are the same idea pointed at
 * different audiences: a customer row lands in `notification`, a staff row in
 * `admin_notification`. The admin repo is optional so a customer-only
 * bootstrap stays valid.
 */
export class DatabaseChannel implements NotificationChannel {
  readonly name = "database";
  readonly method = "toDatabase" as const;

  constructor(
    private readonly repository: DatabaseNotificationRepository,
    private readonly adminRepository?: AdminDatabaseNotificationRepository,
  ) {}

  async send(
    notification: Notification,
    notifiable: ResolvedNotifiable,
  ): Promise<ChannelResult> {
    const render = notification as NotificationRenderers;
    if (!render.toDatabase) {
      return { channel: this.name, status: "skipped", reason: "no-method" };
    }
    const contract = await normalizeContract<DatabaseContract>(
      await render.toDatabase(notifiable),
    );

    if (notifiable.kind === "user") {
      if (!this.adminRepository) {
        return {
          channel: this.name,
          status: "skipped",
          reason: "not-registered",
        };
      }
      const row = await this.adminRepository.create({
        userId: notifiable.userId,
        organizationId: notifiable.organizationId,
        storeId: contract.storeId ?? notifiable.storeId,
        type: contract.type,
        severity: contract.severity ?? "info",
        title: contract.title,
        body: contract.body,
        data: contract.data,
        entityType: contract.entityType,
        entityId: contract.entityId,
      });
      return { channel: this.name, status: "sent", response: row };
    }

    const row = await this.repository.create({
      customerId: notifiable.customerId,
      organizationId: notifiable.organizationId,
      type: contract.type,
      title: contract.title,
      body: contract.body,
      category: notification.category,
      data: contract.data,
    });
    return { channel: this.name, status: "sent", response: row };
  }
}
