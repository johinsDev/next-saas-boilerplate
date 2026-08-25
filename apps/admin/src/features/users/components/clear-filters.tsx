"use client";

import { useQueryStates } from "nuqs";
import { Button } from "@saas/ui";

import { userSearchParams } from "../users-search-params";

/**
 * The way out of an over-narrow filter.
 *
 * Its own file because the empty state around it is rendered on the server and
 * this needs the URL — one small client island beats making the whole empty
 * state a Client Component.
 */
export function ClearFilters() {
  const [, setFilters] = useQueryStates(userSearchParams, { shallow: false });

  return (
    <Button variant="secondary" onClick={() => setFilters({ q: "", status: null, role: null, page: 1 })}>
      Clear every filter
    </Button>
  );
}
