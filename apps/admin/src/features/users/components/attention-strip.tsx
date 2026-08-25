"use client";

import { useQueryStates } from "nuqs";
import { TriangleAlert } from "lucide-react";
import { ATTENTION_STATUSES, type UserFacets } from "@saas/services/users/schemas";

import { userSearchParams } from "../users-search-params";
import { statusLabel } from "./user-badges";

/**
 * What needs doing, above everything else.
 *
 * The reason somebody opens this screen is rarely "show me everyone" — it is
 * that an invitation went unanswered or an account was shut. Those rows are
 * scattered through the list by whatever the sort happens to be, so the count
 * has to be stated rather than discovered.
 *
 * **It renders nothing when nothing is wrong.** A strip that always shows,
 * saying "0 need attention", is a strip everybody learns to skip — and then it
 * is worth nothing on the day it says three.
 *
 * Derived from the facet counts that are already loaded, so it costs no query.
 */
export function AttentionStrip({ facets }: { facets: UserFacets }) {
  const [, setFilters] = useQueryStates(userSearchParams, { shallow: false });

  const needing = ATTENTION_STATUSES.map((status) => ({
    status,
    count: facets.status[status],
  })).filter((entry) => entry.count > 0);

  const total = needing.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) return null;

  /*
   * One status → filter straight to it, because that is unambiguously what
   * "show these" means. Several → there is no single filter for "not active",
   * so the button narrows to the largest group and says which. Pretending one
   * click could show all three would be a control that lies.
   */
  const largest = needing.reduce((a, b) => (b.count > a.count ? b : a));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--warning)]/35 bg-[var(--warning)]/[0.09] px-4 py-2.5">
      <TriangleAlert aria-hidden className="size-4 shrink-0 text-[var(--warning)]" />

      <p className="grow text-xs">
        <strong className="font-semibold">
          {total === 1 ? "One person needs" : `${total} people need`} attention.
        </strong>{" "}
        <span className="text-muted-foreground">
          {needing
            .map((entry) => `${entry.count} ${statusLabel(entry.status).toLowerCase()}`)
            .join(", ")}
          .
        </span>
      </p>

      <button
        type="button"
        onClick={() => setFilters({ status: largest.status, page: 1 })}
        className="shrink-0 text-xs font-semibold text-primary transition-opacity hover:opacity-80"
      >
        {needing.length === 1
          ? "Show them"
          : `Show the ${statusLabel(largest.status).toLowerCase()} ones`}
      </button>
    </div>
  );
}
