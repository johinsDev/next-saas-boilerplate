import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { db } from "@saas/db";
import { getOrganizationSettings } from "@saas/services/organizations";

import { getViewer } from "@/features/auth/auth-queries";

/**
 * The dashboard's reads.
 *
 * `server-only` and the cache directives live here, not in `@saas/services`.
 * `use cache` is a Next compiler construct: put it in the shared package and
 * the same function would silently stop caching the moment the Hono Worker
 * called it — one function, two behaviours, and the difference only shows up in
 * production.
 */

export const ORGANIZATION_TAG = "organization";

/**
 * The uncached wrapper. It reads the session — request data — and hands the
 * resolved id to the cached function below.
 *
 * This split is the single most reusable idiom in the architecture, and it
 * exists because **you cannot call `cookies()` inside `'use cache'`**. Hoisting
 * the request read out and passing the value as an argument makes that value
 * part of the cache key, which is what lets per-viewer data be cached at all.
 */
export async function readWorkspace() {
  const viewer = await getViewer();
  if (!viewer?.organizationId) return null;

  return readWorkspaceForOrg(viewer.organizationId);
}

/**
 * The cached inner. Not exported: nothing should be able to call it with an
 * organization id the caller did not prove they belong to.
 *
 * Plain `'use cache'`, not `private` — the id is an argument, so it is part of
 * the key, and two organizations can never see each other's entry. The privacy
 * comes from the key, not from the directive.
 */
async function readWorkspaceForOrg(organizationId: string) {
  "use cache";
  /*
   * `minutes` is the backstop; the tag is what actually keeps this honest. A
   * settings change calls `updateTag(ORGANIZATION_TAG)` and expires it at once.
   */
  cacheLife("minutes");
  cacheTag(ORGANIZATION_TAG, `${ORGANIZATION_TAG}:${organizationId}`);

  return getOrganizationSettings(db, organizationId);
}
