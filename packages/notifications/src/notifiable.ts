import type {
  Notifiable,
  ResolvedCustomerNotifiable,
  ResolvedUserNotifiable,
} from "./types";

/**
 * Resolves a recipient's contact info from persistent storage. The concrete
 * Drizzle implementation lives in the app/jobs bootstrap (it imports
 * `@saas/db`); the package ships only this interface so the engine stays
 * free of a hard DB dependency.
 */
export interface NotifiableRepository {
  /** Full contact info, or `null` if no such customer in the org. */
  resolve(
    customerId: string,
    organizationId: string,
  ): Promise<ResolvedCustomerNotifiable | null>;
  /**
   * Same for a staff `user`. Optional so implementations that only ever
   * notify customers stay valid — the notifier raises a clear error if a
   * `kind: "user"` recipient arrives without it.
   */
  resolveUser?(
    userId: string,
    organizationId: string,
  ): Promise<ResolvedUserNotifiable | null>;
}

/**
 * True when a `Notifiable` already carries every field a channel might need,
 * so the engine can skip the repository lookup. For customers `phone` is
 * mandatory on the resolved shape, so a missing phone always forces a lookup;
 * for staff users a null phone is legitimate, but it must be stated explicitly
 * (`undefined` still means "go look it up").
 */
export function isFullyResolved(n: Notifiable): boolean {
  if (n.email === undefined || n.name === undefined) return false;
  if (n.kind === "user") return n.phone !== undefined;
  return typeof n.phone === "string" && n.phone.length > 0;
}
