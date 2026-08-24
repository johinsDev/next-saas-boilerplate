import { ROLES, type Role } from "@saas/auth/server";
import type { AdminAlertSeverity } from "@saas/db/schema";

/**
 * The alert catalog: what operators get told about, who hears it, how loud.
 *
 * A plain object literal on purpose — this package is bundled into the Worker,
 * and workerd forbids code generation, so no factories or computed lookups.
 *
 * Two concepts stay separate. **Alerts** (this file) want attention: a handful
 * a week, with a badge and a read state. The firehose of everything that
 * happens belongs to the audit log, which has neither. Put routine events in
 * here and the inbox drowns within a week.
 */
export const ADMIN_ALERT_TYPES = [
  "staff-role-changed",
  "staff-disabled",
  "impersonation-started",
  "invite-accepted",
  "user-signup",
  "user-banned",
  "billing-failed",
  "daily-digest",
] as const;

export type AdminAlertType = (typeof ADMIN_ALERT_TYPES)[number];

/**
 * How an alert reaches the inbox.
 *
 * - `immediate` — a row, now.
 * - `threshold` — a row only when the change is big enough to care about;
 *   smaller ones are counted into the daily digest instead.
 * - `digest` — never its own row; only a line in the daily summary.
 * - `cron` — produced by a scheduled job rather than an event.
 */
export type AdminAlertDelivery = "immediate" | "threshold" | "digest" | "cron";

/** Channels an operator alert can use. */
export type AdminAlertChannel = "database" | "mail";

export interface AdminAlertDefinition {
  /** Lowest operator role that receives it. */
  minRole: Role;
  delivery: AdminAlertDelivery;
  /** Only for `threshold` delivery: the absolute change that earns a row. */
  threshold?: number;
  severity: AdminAlertSeverity;
  /**
   * Channels this alert can travel on — one source of truth shared by the
   * notification's `via()` and the config screen.
   */
  channels: AdminAlertChannel[];
}

export const ADMIN_ALERTS: Record<AdminAlertType, AdminAlertDefinition> = {
  "staff-role-changed": {
    minRole: ROLES.owner,
    delivery: "immediate",
    severity: "warning",
    channels: ["database"],
  },
  "staff-disabled": {
    minRole: ROLES.owner,
    delivery: "immediate",
    severity: "warning",
    channels: ["database"],
  },
  "impersonation-started": {
    minRole: ROLES.owner,
    delivery: "immediate",
    severity: "warning",
    channels: ["database", "mail"],
  },
  "invite-accepted": {
    minRole: ROLES.manager,
    delivery: "immediate",
    severity: "info",
    channels: ["database"],
  },
  "user-signup": {
    minRole: ROLES.manager,
    delivery: "digest",
    severity: "info",
    channels: ["database"],
  },
  "user-banned": {
    minRole: ROLES.manager,
    delivery: "immediate",
    severity: "warning",
    channels: ["database"],
  },
  "billing-failed": {
    minRole: ROLES.owner,
    delivery: "immediate",
    severity: "critical",
    channels: ["database", "mail"],
  },
  "daily-digest": {
    minRole: ROLES.manager,
    delivery: "cron",
    severity: "info",
    channels: ["database", "mail"],
  },
};
