import { db } from "./client";
import { organization } from "./schema";

/**
 * The organization to attribute an event to when nothing else says which.
 *
 * Single-tenant deployments have exactly one; multi-tenant ones should pass the
 * organization explicitly and never reach for this. It exists so the auth audit
 * hooks, which run outside any request scope, still have something to write.
 */
export async function getPrimaryOrganizationId(): Promise<string | null> {
  const rows = await db.select({ id: organization.id }).from(organization).limit(1);
  return rows[0]?.id ?? null;
}
