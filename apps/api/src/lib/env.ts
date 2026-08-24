/**
 * What the Worker is given at runtime.
 *
 * Secrets arrive through `wrangler secret put` and appear here; nothing in this
 * type may be read at module scope, because Workers have no environment until a
 * request arrives.
 */
export type Bindings = {
  ENVIRONMENT: string;
  DATABASE_URL: string;
  DATABASE_AUTH_TOKEN?: string;
};

/** What each request carries once the middleware has built it. */
export type Variables = {
  db: import("@saas/db").Database;
  requestId: string;
};

export type Env = { Bindings: Bindings; Variables: Variables };
