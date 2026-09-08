import * as Sentry from "@sentry/cloudflare";
import { Hono } from "hono";
import { createDb } from "@saas/db";
import type { Bindings, Env } from "./lib/env";
import { toHttpError } from "./lib/errors";
import { organizations } from "./routes/organizations";

const app = new Hono<Env>();

/*
 * One database client per request. Workers bind I/O to the request that opened
 * it, so a module-level client works in development and then fails in
 * production the moment a second request reuses it.
 */
app.use("*", async (c, next) => {
  c.set(
    "db",
    createDb({ url: c.env.DATABASE_URL, authToken: c.env.DATABASE_AUTH_TOKEN }),
  );
  c.set("requestId", crypto.randomUUID());
  await next();
});

app.onError((error, c) => {
  const { status, body } = toHttpError(error);
  return c.json(body, status as 400);
});

/**
 * The chain is the contract.
 *
 * `AppType` is inferred from this expression, so every route has to hang off
 * it. Consumers import the type and nothing else:
 *
 * ```ts
 * import { hc } from "hono/client";
 * import type { AppType } from "@saas/api";   // type-only: 0 bytes at runtime
 *
 * const api = hc<AppType>(process.env.EXPO_PUBLIC_API_URL!);
 * const res = await api.organizations[":id"].settings.$get({ param: { id } });
 * ```
 *
 * The contract is a **type-only** import: the mobile bundle gets it at compile
 * time and ships nothing at runtime. Never replace this with an RPC layer that
 * ships a runtime client — on a React Native bundle that cost is the decision.
 */
const routes = app
  .get("/health", (c) => c.json({ ok: true, environment: c.env.ENVIRONMENT }))
  .route("/organizations", organizations);

export type AppType = typeof routes;

/**
 * Error reporting.
 *
 * `@sentry/cloudflare`, not `@sentry/node`: a Worker has no process, and the
 * wrapper is what gives Sentry the request context and the `waitUntil` it needs
 * to flush before the isolate is torn down. Reporting from a handler without it
 * loses events whenever the response finishes first.
 *
 * Inert without `SENTRY_DSN`, so a clone with no Sentry account deploys and
 * runs unchanged.
 */
export default Sentry.withSentry(
  (env: Bindings) => ({
    dsn: env.SENTRY_DSN ?? "",
    enabled: !!env.SENTRY_DSN,
    environment: env.ENVIRONMENT,
    tracesSampleRate: env.ENVIRONMENT === "production" ? 0.1 : 1,
    sendDefaultPii: false,
  }),
  app,
);
