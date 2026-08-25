import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { coerceRole, decideAccess, ROLES, type Role } from "@saas/auth";
import { db, schema } from "@saas/db";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { PATHNAME_HEADER } from "@/lib/proxy-headers";
import { auth } from "@/lib/auth";

/**
 * Reads. `server-only` lives here rather than in `@saas/auth`, because that
 * guard is a Next construct and throws anywhere React is not — including the
 * Worker and a plain test run.
 */

export const VIEWER_TAG = "viewer";

export type Viewer = {
  readonly userId: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: Role;
};

/**
 * The signed-in visitor, **or null — which is a normal state here.**
 *
 * That is the difference from the admin, where null means "you should not be
 * looking at this". In the customer app most pages render perfectly well for an
 * anonymous visitor, and the header simply shows a sign-in link instead of an
 * account chip. Callers must handle null as a UI state, not as an error.
 *
 * `'use cache: private'` for the same reason as everywhere else: this is the
 * one read whose request data *is* the input, so it cannot be hoisted out.
 * Browser memory only — never the server's store.
 */
export async function getViewer(): Promise<Viewer | null> {
  "use cache: private";
  cacheLife({ stale: 60 });
  cacheTag(VIEWER_TAG);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const [row] = await db
    .select({ role: schema.member.role })
    .from(schema.member)
    .where(eq(schema.member.userId, session.user.id))
    .limit(1);

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    role: coerceRole(row?.role),
  };
}

/**
 * For the pages that do require a session. Uncached, because `redirect()` works
 * by throwing and a thrown control-flow signal has no business in a cache
 * entry.
 *
 * The bar is `customer`: signed in at all. Staff roles clear it too — an owner
 * looking at their own account page is not an error.
 */
export async function verifyAuth(minimum: Role = ROLES.customer): Promise<Viewer> {
  const viewer = await getViewer();
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/";

  const decision = decideAccess({
    session: viewer ? { userId: viewer.userId } : null,
    role: viewer?.role ?? null,
    minimum,
    pathname,
  });

  if (decision.kind === "redirect") redirect(decision.to as Route);
  if (decision.kind === "forbidden") redirect("/" as Route);

  return viewer as Viewer;
}
