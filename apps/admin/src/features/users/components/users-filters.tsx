"use client";

import { useQueryStates } from "nuqs";
import { useEffect, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import type { Role } from "@saas/auth/roles";
import { USER_STATUSES, type UserFacets, type UserStatus } from "@saas/services/users/schemas";
import {
  cn,
  Input,
  MotionSelect as Select,
  MotionSelectContent as SelectContent,
  MotionSelectItem as SelectItem,
  MotionSelectTrigger as SelectTrigger,
  MotionSelectValue as SelectValue,
} from "@saas/ui";

import { userSearchParams } from "../users-search-params";
import { SortSelect } from "./users-table-controls";
import { roleLabel } from "./user-badges";

/**
 * The roster's controls, bound to the URL.
 *
 * `shallow: false` on every write is the point: it tells nuqs to let the server
 * re-render, which is what re-runs the query. Left at its default the URL would
 * change and the table would not, which looks exactly like a broken filter.
 *
 * Which controls appear is decided by the caller, because staff and customers are
 * now separate screens and a role filter on a list where everybody is a player
 * is a control with one useful position.
 */

/**
 * The value a select carries for "no filter". Selects hold strings, not null.
 *
 * Plain `any`, not a decorated sentinel: none of the statuses or roles is
 * called that, and if it ever does leak onto the screen it reads as a word
 * rather than as a bug.
 */
const ANY = "any";

export function UsersFilters({
  facets,
  roles,
}: {
  facets: UserFacets;
  /** Role options for this roster. Omit or pass none to hide the control. */
  roles?: readonly Role[];
}) {
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(userSearchParams, {
    shallow: false,
    startTransition,
  });

  /**
   * Exactly one panel open at a time.
   *
   * beUI positions the panel absolutely **inside its own field**, so two open
   * at once paint over each other's options — its own documentation says as
   * much. Holding the open id here is what the controlled `open` prop is for.
   */
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  /**
   * Any change to a facet returns to the first page.
   *
   * Without it, narrowing the roster while on page 3 lands on a page that no
   * longer exists — the service clamps it, so you get the last page of the new
   * result set with the control still saying 3. Confusing rather than broken,
   * which is worse.
   */
  const set = (patch: Partial<typeof filters>) => setFilters({ ...patch, page: 1 });

  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 transition-opacity",
        // Dimmed, not replaced. Swapping in a skeleton would take the controls
        // out from under the cursor mid-click.
        pending && "opacity-60",
      )}
    >
      <SearchBox value={filters.q} onChange={(q) => set({ q })} />

      <Field label="Status">
        <Select
          value={filters.status ?? ANY}
          onValueChange={(value) => set({ status: value === ANY ? null : (value as UserStatus) })}
          open={openPanel === "status"}
          onOpenChange={(open) => setOpenPanel(open ? "status" : null)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            {/*
             * One template literal, not `{"Any status · "}{count}`.
             *
             * `SelectItem` takes its label from `children` only when children
             * is a *string* — anything else falls back to the raw `value`, and
             * the closed trigger then reads "any" instead of "Any status". Two
             * expressions in the body make children an array, which is exactly
             * how that happened.
             *
             * The count rides along in the label because it is the one thing
             * the segmented buttons did better: it says what clicking would
             * get you before you click.
             */}
            <SelectItem value={ANY}>{`Any status · ${facets.total}`}</SelectItem>
            {USER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {`${status[0]!.toUpperCase()}${status.slice(1)} · ${facets.status[status]}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {roles && roles.length > 0 && (
        <Field label="Role">
          <Select
            value={filters.role ?? ANY}
            onValueChange={(value) => set({ role: value === ANY ? null : (value as Role) })}
            open={openPanel === "role"}
            onOpenChange={(open) => setOpenPanel(open ? "role" : null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any role</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role} value={role}>
                  {roleLabel(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {/*
       * Only below `md`, where the column headers it stands in for do not
       * exist. Showing both would be two controls for one piece of state, and
       * they would disagree the moment somebody used the one that offers
       * combinations the other does not.
       */}
      <div className="md:hidden">
        <SortSelect />
      </div>

      {(filters.q || filters.status || filters.role) && (
        <button
          type="button"
          onClick={() => set({ q: "", status: null, role: null })}
          className="h-9 rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-40 flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Debounced, because every settled keystroke is a round trip.
 *
 * The input keeps its own state so typing stays responsive while the URL trails
 * behind it. The effect re-syncs when `value` changes from outside — the back
 * button, or Clear filters — which is the case a plain uncontrolled input gets
 * wrong.
 */
function SearchBox({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), 300);
    return () => clearTimeout(timer);
    // `onChange` is a fresh closure each render; depending on it would restart
    // the timer on every keystroke and the search would never fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, value]);

  return (
    <div className="flex min-w-56 grow flex-col gap-1.5 sm:grow-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Search
      </span>

      <label className="relative flex items-center">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
        />
        <span className="sr-only">Search by name or email</span>
        <Input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Name or email"
          /*
           * `type="search"` earns its semantics and brings a native clear
           * button with it, which sat next to ours — two crosses, one of them
           * unstyled. Suppressing the native one keeps the semantics and the
           * control we can position and theme.
           */
          className="pl-9 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {text.length > 0 && (
          <button
            type="button"
            onClick={() => setText("")}
            className="absolute right-2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden className="size-3.5" />
            <span className="sr-only">Clear search</span>
          </button>
        )}
      </label>
    </div>
  );
}
