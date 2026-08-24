import { Hono } from "hono";
import { getOrganizationSettings } from "@saas/services";
import type { Env } from "../lib/env";

/**
 * The transport, and nothing else.
 *
 * A route parses, authenticates, calls a service and serialises. Business rules
 * that live in a handler are unreachable from the Next apps, which call the
 * service directly — that is how two implementations of one rule begin.
 *
 * Routes are chained rather than declared separately, because `hc<AppType>`
 * infers the client from the chain. Break the chain and the client silently
 * loses those paths from its type.
 */
export const organizations = new Hono<Env>().get("/:id/settings", async (c) => {
  const settings = await getOrganizationSettings(c.get("db"), c.req.param("id"));

  return c.json(settings);
});
