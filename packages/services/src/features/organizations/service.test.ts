import { describe, expect, test } from "vitest";
import type { Database } from "@saas/db";
import { getOrganizationSettings } from "./service";

/**
 * The service takes its database as an argument, which is what lets this test
 * run without one. A service that reached for a module-level singleton would
 * need a real connection to test a branch that never touches the network.
 */
function fakeDb(rows: unknown[]): Database {
  const result = {
    from: () => result,
    where: () => result,
    limit: () => Promise.resolve(rows),
  };
  return { select: () => result } as unknown as Database;
}

describe("getOrganizationSettings", () => {
  test("returns the row the organization has", async () => {
    const stored = { organizationId: "org_1", defaultLocale: "es", currency: "COP" };

    expect(await getOrganizationSettings(fakeDb([stored]), "org_1")).toBe(stored);
  });

  test("falls back to defaults instead of making every caller handle a missing row", async () => {
    const settings = await getOrganizationSettings(fakeDb([]), "org_1");

    expect(settings.organizationId).toBe("org_1");
    expect(settings.defaultLocale).toBe("en");
    expect(settings.currency).toBe("USD");
    expect(settings.timezone).toBe("UTC");
  });
});
