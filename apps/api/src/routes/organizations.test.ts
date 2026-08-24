import { describe, expect, test } from "vitest";
import { Hono } from "hono";
import type { Env } from "../lib/env";
import { organizations } from "./organizations";

/** A request that carries a stub database, the way the middleware would. */
function callWith(rows: unknown[]) {
  const query = { from: () => query, where: () => query, limit: () => Promise.resolve(rows) };
  const app = new Hono<Env>()
    .use("*", async (c, next) => {
      c.set("db", { select: () => query } as never);
      await next();
    })
    .route("/organizations", organizations);

  return app;
}

describe("GET /organizations/:id/settings", () => {
  test("returns the settings the organization has", async () => {
    const app = callWith([{ organizationId: "org_1", defaultLocale: "es", currency: "COP" }]);

    const response = await app.request("/organizations/org_1/settings");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ defaultLocale: "es", currency: "COP" });
  });

  test("answers with defaults rather than a 404 when the row is missing", async () => {
    const app = callWith([]);

    const response = await app.request("/organizations/org_1/settings");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ defaultLocale: "en", currency: "USD" });
  });
});
