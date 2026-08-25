"use client";

import { useQueryStates } from "nuqs";
import { useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { UserSort } from "@saas/services/users/schemas";
import { Button, cn } from "@saas/ui";

import { userSearchParams } from "../users-search-params";

/**
 * The two controls that live inside the table and have to be interactive.
 *
 * They are the only client components in it. The rows themselves are rendered
 * on the server, which is what keeps a hundred-row table off the client bundle
 * — and why `table.tsx` had its `"use client"` removed on the way in.
 */

/** A column heading that sorts. Clicking the active one reverses it. */
export function SortHeader({ column, children }: { column: UserSort; children: React.ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [{ sort, direction }, setFilters] = useQueryStates(userSearchParams, {
    shallow: false,
    startTransition,
  });

  const active = sort === column;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        setFilters({
          sort: column,
          // A new column starts ascending; the active one flips. Carrying the
          // previous direction over to a new column means the first click on
          // "Joined" can silently sort oldest-first.
          direction: active && direction === "asc" ? "desc" : "asc",
          // Row 26 of page 2 is not row 26 of page 2 once the order changes.
          page: 1,
        })
      }
      className={cn(
        "flex items-center gap-1.5 text-left transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      {children}
      {active ? (
        direction === "asc" ? (
          <ArrowUp aria-hidden className="size-3" />
        ) : (
          <ArrowDown aria-hidden className="size-3" />
        )
      ) : (
        <ChevronsUpDown aria-hidden className="size-3 opacity-40" />
      )}
    </button>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  shown,
}: {
  page: number;
  pageCount: number;
  total: number;
  shown: number;
}) {
  const [pending, startTransition] = useTransition();
  const [, setFilters] = useQueryStates(userSearchParams, { shallow: false, startTransition });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        {/*
         * The count is of what matched, not of everyone — otherwise a filtered
         * view reads as though the filter did nothing.
         */}
        Showing <span className="font-semibold text-foreground">{shown}</span> of{" "}
        <span className="font-semibold text-foreground">{total.toLocaleString("en")}</span> matching
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || page <= 1}
          onClick={() => setFilters({ page: page - 1 })}
        >
          Previous
        </Button>

        <span className="text-xs tabular-nums text-muted-foreground">
          Page {page} of {pageCount}
        </span>

        <Button
          variant="ghost"
          size="sm"
          disabled={pending || page >= pageCount}
          onClick={() => setFilters({ page: page + 1 })}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
