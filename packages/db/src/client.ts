// The /web client talks libSQL over HTTP/fetch — no native bindings. All our
// connections are HTTP (remote `libsql://` Turso + local `http://` sqld), never
// file/embedded, so this works everywhere AND bundles cleanly (Next server
// chunks, the Trigger.dev deploy image) without a platform-specific .node.
import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql/web";
// type-only (erased at compile — no runtime/native import)
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

type Db = LibSQLDatabase<typeof schema>;

// Lazy: the real client is built on first use, not at import. Importing
// `@saas/db` must be side-effect free so it can be bundled where env isn't
// present yet — e.g. `trigger deploy` indexes task files in a sandbox with no
// DATABASE_URL, and `next build` traces routes. The throw + connection are
// deferred to the first actual query.
let instance: Db | undefined;

/**
 * Build a **fresh** libSQL/drizzle client. Cloudflare Workers bind an I/O object
 * to the request that created it, so a module singleton shared across concurrent
 * requests gets canceled ("cross-request promise resolution"). The per-request
 * tRPC context calls this so each request owns its client; long-lived runtimes
 * (Node scripts, jobs) keep using the {@link db} singleton below.
 */
export function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return drizzle(client, { schema, casing: "snake_case" });
}

function resolve(): Db {
  if (instance) return instance;
  instance = createDb();
  return instance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = resolve() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type Database = Db;
