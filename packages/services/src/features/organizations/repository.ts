import { eq } from "drizzle-orm";
import type { Database } from "@saas/db";
import { organizationSettings } from "@saas/db/schema";

/** Rows in, rows out. No business rules live here. */
export async function selectSettingsByOrganization(db: Database, organizationId: string) {
  const rows = await db
    .select()
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, organizationId))
    .limit(1);

  return rows[0] ?? null;
}
