import type { Database } from "@saas/db";
import { selectSettingsByOrganization } from "./repository";

/**
 * The business rules — the layer worth testing.
 *
 * Services take their dependencies as arguments rather than reaching for a
 * module-level singleton, which is what makes them testable without a database
 * and what lets the Worker create one client per request.
 */
export async function getOrganizationSettings(db: Database, organizationId: string) {
  const settings = await selectSettingsByOrganization(db, organizationId);
  if (settings) return settings;

  // An organization with no settings row behaves as one with defaults, rather
  // than as an error every caller has to remember to handle.
  return {
    organizationId,
    defaultLocale: "en",
    supportedLocales: ["en"],
    currency: "USD",
    timezone: "UTC",
  } as const;
}
