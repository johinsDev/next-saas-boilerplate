import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import {
  getUser,
  getUserFacets,
  getUserPage,
  type UserDetail,
  type Population,
  type UserFacets,
  type UserFilters,
  type UserPage,
} from "@saas/services/users";

/**
 * The roster's reads.
 *
 * `server-only` and the cache directives live here, not in `@saas/services`:
 * `use cache` is a Next compiler construct, and putting it in the shared
 * package would give the same function two behaviours depending on whether Next
 * or the Hono Worker called it.
 *
 * **Most of this is deliberately not cached, and that is the interesting part.**
 * The idiom is worth applying where it has a reason; applied everywhere it is
 * the shape of the idiom without the reason, which is the note already standing
 * in `dashboard-queries.ts`.
 */

export const USERS_TAG = "users";

/**
 * One page of the roster. **Not cached**, on purpose.
 *
 * Its key would have to include free-text search, so every keystroke that
 * settles is a new entry for a screen an operator opens occasionally — a cache
 * that mostly misses, and grows while missing. Against that, the cost of being
 * wrong is high and immediate: the roster is what you look at right after
 * changing somebody's role, and a stale answer there reads as "the change did
 * not take".
 *
 * It is dynamic inside its own Suspense boundary instead, which is what makes
 * the page around it prerender.
 */
export async function readUserPage(filters: Partial<UserFilters>): Promise<UserPage> {
  return getUserPage(filters);
}

/**
 * The counts beside the filter controls. **Cached** — this is where the idiom
 * earns its place.
 *
 * Two keys, one per roster — and that is the whole cost. `population` is a
 * resolved value rather than request data, so it is simply part of the cache
 * key; the facets are unfiltered within it (see `UserFacets`). Both entries are
 * shared by every member of staff and refreshed by `updateTag(USERS_TAG)` the
 * moment anybody writes.
 *
 * No uncached-wrapper/cached-inner split, because there is nothing to hoist:
 * that pattern exists to lift `cookies()` out of a cached scope, and these
 * numbers are the same for everyone who can see them.
 */
export async function readUserFacets(population: Population): Promise<UserFacets> {
  "use cache";
  cacheLife("minutes");
  cacheTag(USERS_TAG);

  return getUserFacets(population);
}

/**
 * One user, with their live sessions. **Not cached**, and here the reason is
 * sharper than the list's.
 *
 * The sessions are the ones that would still let somebody in, and the only
 * reason to look at them is to decide what to revoke. A cached copy showing a
 * session that was revoked a minute ago is not a stale figure — it is a
 * security screen telling you something untrue about access.
 */
export async function readUser(id: string): Promise<UserDetail | null> {
  return getUser(id);
}
