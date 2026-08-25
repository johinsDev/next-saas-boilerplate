"use client";

import { useQueryStates } from "nuqs";
import { useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { UserSort } from "@saas/services/users/schemas";
import {
  Button,
  cn,
  MotionSelect as Select,
  MotionSelectContent as SelectContent,
  MotionSelectItem as SelectItem,
  MotionSelectTrigger as SelectTrigger,
  MotionSelectValue as SelectValue,
} from "@saas/ui";

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

/**
 * Sorting, as one control.
 *
 * Column headers are the right affordance on a wide screen and impossible on a
 * narrow one: below `md` the rows are cards, and a card has no header row to
 * click. Combining column and direction into one list also says what the order
 * *means* — "Newest first" rather than a caret whose direction you have to
 * decode.
 *
 * The pairs are written out rather than generated from `USER_SORTS` because
 * only some of them are worth offering: nobody sorts a roster by role
 * descending on a phone.
 */
const ORDERS: readonly { value: string; label: string; sort: UserSort; direction: "asc" | "desc" }[] =
  [
    { value: "joined:desc", label: "Newest first", sort: "joined", direction: "desc" },
    { value: "joined:asc", label: "Oldest first", sort: "joined", direction: "asc" },
    { value: "name:asc", label: "Name A–Z", sort: "name", direction: "asc" },
    { value: "name:desc", label: "Name Z–A", sort: "name", direction: "desc" },
    { value: "email:asc", label: "Email A–Z", sort: "email", direction: "asc" },
    { value: "role:desc", label: "Most senior first", sort: "role", direction: "desc" },
  ];

export function SortSelect() {
  const [pending, startTransition] = useTransition();
  const [{ sort, direction }, setFilters] = useQueryStates(userSearchParams, {
    shallow: false,
    startTransition,
  });

  const current = `${sort}:${direction}`;
  // A combination the list does not offer — reachable from the desktop headers,
  // or by hand in the URL. Showing the placeholder beats lighting the wrong row.
  const known = ORDERS.some((order) => order.value === current);

  return (
    <div className={cn("flex min-w-44 flex-col gap-1.5", pending && "opacity-60")}>
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Sort
      </span>

      <Select
        value={known ? current : ""}
        onValueChange={(value) => {
          const order = ORDERS.find((candidate) => candidate.value === value);
          if (!order) return;
          // Back to the first page: row 26 of page 2 is not row 26 of page 2
          // once the order changes.
          setFilters({ sort: order.sort, direction: order.direction, page: 1 });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Custom order" />
        </SelectTrigger>
        <SelectContent>
          {ORDERS.map((order) => (
            <SelectItem key={order.value} value={order.value}>
              {order.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
