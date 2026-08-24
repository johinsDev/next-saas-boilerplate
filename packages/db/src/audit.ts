import { db } from "./client";
import * as schema from "./schema";
import type { AuditType } from "./schema";

export type RecordAuditInput = {
  organizationId?: string | null;
  /** Who performed the action (null for self/system events like a plain login). */
  actorUserId?: string | null;
  /** The employee/user the action is about (the activity feed filters on it). */
  targetUserId?: string | null;
  type: AuditType;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Append a row to the `audit_log`. Best-effort and never throws — auditing must
 * not block the action it records (a failed insert is logged, not propagated).
 * Used by the Better Auth session hooks (login/logout) and the employees
 * service (invite/role/disable/email/impersonation/…).
 */
export async function recordAudit(entry: RecordAuditInput): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({
      organizationId: entry.organizationId ?? null,
      actorUserId: entry.actorUserId ?? null,
      targetUserId: entry.targetUserId ?? null,
      type: entry.type,
      metadata: entry.metadata ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch (error) {
    console.error("[audit] failed to record event", {
      type: entry.type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
