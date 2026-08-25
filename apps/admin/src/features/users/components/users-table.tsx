import { SearchX, UserRoundPlus } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  HoverPrefetchLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@saas/ui";
import type { Route } from "next";
import type { Role } from "@saas/auth/roles";
import type { UserFilters, UserSummary } from "@saas/services/users/schemas";

import { getViewer } from "@/features/auth/auth-queries";
import { readUserPage } from "../users-queries";
import { ClearFilters } from "./clear-filters";
import { RoleBadge, StatusMark, StatusNote, statusRail } from "./user-badges";
import { UserRowActions } from "./user-row-actions";
import { Pagination, SortHeader } from "./users-table-controls";

/**
 * The roster.
 *
 * A Server Component, and the rows stay that way: the only client code in the
 * table is the sort headers, the pager and the row menu. Rendering a hundred
 * rows on the client to make three controls interactive is the trade this
 * avoids.
 *
 * It reads `readUserPage` uncached on purpose — see the note there. This is the
 * screen you look at immediately after changing somebody's role, and a stale
 * answer reads as "the change did not take".
 */
/** Whether anything is narrowing the list — which decides which emptiness this is. */
function isFiltered(filters: Partial<UserFilters>): boolean {
  return Boolean(filters.q || filters.status || filters.role);
}

export async function UsersTable({
  filters,
  roles,
  menuRoles,
}: {
  filters: Partial<UserFilters>;
  /** Roles this roster can be filtered by. Empty or absent hides the Role column. */
  roles?: readonly Role[];
  /** Roles the row menu can assign — every roster can move somebody anywhere. */
  menuRoles?: readonly Role[];
}) {
  const [{ users, total, page, pageCount }, viewer] = await Promise.all([
    readUserPage(filters),
    getViewer(),
  ]);

  if (users.length === 0) return <EmptyRoster filtered={isFiltered(filters)} />;

  // The route the rows link to. Staff and customers have their own detail pages
  // so the sidebar keeps highlighting the section you are actually in.
  const base = filters.population === "player" ? "customers" : "staff";
  const showRole = Boolean(roles?.length);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/*
       * Two renderings of the same rows, and the breakpoint is not cosmetic.
       * Five columns in 390px means the last two fall off the edge — which is
       * exactly what a status column doing is: invisible. Cards below `md` put
       * every field on its own line and keep the row menu reachable; the sort
       * moves into a select, because a card has no header to click.
       */}
      <ul className="flex flex-col md:hidden">
        {users.map((user) => (
          <Card
            key={user.id}
            user={user}
            base={base}
            showRole={showRole}
            roles={menuRoles}
            viewerId={viewer?.userId ?? ""}
            viewerIsOwner={viewer?.role === "owner"}
          />
        ))}
      </ul>

      <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em]">
              <SortHeader column="name">Person</SortHeader>
            </TableHead>
            {showRole && (
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em]">
                <SortHeader column="role">Role</SortHeader>
              </TableHead>
            )}
            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em]">
              Status
            </TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em]">
              <SortHeader column="joined">Joined</SortHeader>
            </TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {users.map((user) => (
            <Row
              key={user.id}
              user={user}
              base={base}
              showRole={showRole}
              roles={menuRoles}
              viewerId={viewer?.userId ?? ""}
              viewerIsOwner={viewer?.role === "owner"}
            />
          ))}
        </TableBody>
      </Table>
      </div>

      <Pagination page={page} pageCount={pageCount} total={total} shown={users.length} />
    </div>
  );
}

function Row({
  user,
  base,
  showRole,
  roles,
  viewerId,
  viewerIsOwner,
}: {
  user: UserSummary;
  base: string;
  showRole: boolean;
  roles?: readonly Role[];
  viewerId: string;
  viewerIsOwner: boolean;
}) {
  const label = user.name?.trim() || user.email || user.id;

  return (
    <TableRow>
      {/*
       * The rail rides the first CELL, not the row.
       *
       * The table is `border-collapse: collapse`, and in the collapsed border
       * model a `<tr>` does not paint its own box-shadow — the value computes
       * and simply never draws, which is a silent way to lose it. Cells paint
       * theirs.
       */}
      <TableCell style={{ boxShadow: `inset 3px 0 0 0 ${statusRail(user.status)}` }}>
        {/*
         * `HoverPrefetchLink`, not a plain `<Link prefetch>`. Twenty-five rows
         * each resolving their own params on scroll is twenty-five server
         * invocations; this takes the shared App Shell for free and asks for
         * the rest when the pointer arrives.
         */}
        <HoverPrefetchLink
          /*
           * `typedRoutes` wants a literal it can check, and a row's href is
           * built from an id at run time. One cast here, rather than loosening
           * the setting for the whole app. Note the plain `typecheck` misses
           * this: the route types are generated during `build`.
           */
          href={`/${base}/${user.id}` as Route}
          className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-extrabold uppercase text-secondary-foreground"
          >
            {initials(label)}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-foreground">{label}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email ?? "—"}</span>
          </span>
        </HoverPrefetchLink>
      </TableCell>

      {showRole && (
        <TableCell>
          <RoleBadge role={user.role} />
        </TableCell>
      )}

      <TableCell>
        <span className="flex flex-col gap-0.5">
          <StatusMark status={user.status} />
          <StatusNote user={user} />
        </span>
      </TableCell>

      <TableCell className="text-xs tabular-nums text-muted-foreground">
        {formatJoined(user.joinedAt)}
      </TableCell>

      <TableCell>
        <UserRowActions
          user={user}
          viewerId={viewerId}
          viewerIsOwner={viewerIsOwner}
          roles={roles}
        />
      </TableCell>
    </TableRow>
  );
}

/**
 * One person, on a narrow screen.
 *
 * The same data as a row, stacked. The name block is the link — a whole-card
 * link would swallow the menu button inside it, and a card with one tap target
 * that does two things is a card that does the wrong one.
 */
function Card({
  user,
  base,
  showRole,
  roles,
  viewerId,
  viewerIsOwner,
}: {
  user: UserSummary;
  base: string;
  showRole: boolean;
  roles?: readonly Role[];
  viewerId: string;
  viewerIsOwner: boolean;
}) {
  const label = user.name?.trim() || user.email || user.id;

  return (
    <li
      className="flex items-start gap-3 border-b border-border p-4 last:border-b-0"
      style={{ boxShadow: `inset 3px 0 0 0 ${statusRail(user.status)}` }}
    >
      <HoverPrefetchLink
        href={`/${base}/${user.id}` as Route}
        className="flex min-w-0 grow items-start gap-3 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-extrabold uppercase text-secondary-foreground"
        >
          {initials(label)}
        </span>

        <span className="flex min-w-0 grow flex-col gap-1.5">
          <span className="flex flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-foreground">{label}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email ?? "—"}</span>
          </span>

          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {showRole && <RoleBadge role={user.role} />}
            <StatusMark status={user.status} />
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatJoined(user.joinedAt)}
            </span>
          </span>

          <StatusNote user={user} />
        </span>
      </HoverPrefetchLink>

      <UserRowActions
        user={user}
        viewerId={viewerId}
        viewerIsOwner={viewerIsOwner}
        roles={roles}
      />
    </li>
  );
}

/**
 * A fixed locale and UTC.
 *
 * `toLocaleDateString()` with neither reads the server's, so the same row
 * renders a day earlier or later depending on where it was rendered — and it
 * mismatches between server and client, which React reports as a hydration
 * error.
 */
function formatJoined(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function initials(label: string): string {
  const [first = "", second = ""] = label.replace(/@.*/, "").split(/[\s._-]+/);
  return ((first[0] ?? "") + (second[0] ?? "")).trim() || label.slice(0, 2);
}

/**
 * Two emptinesses, and they are not the same screen.
 *
 * "Nobody here" is a product state with one obvious next move. "Nobody
 * matching" is a filter state, and the useful thing to say is how many there
 * are when you stop filtering — otherwise the reader cannot tell whether the
 * roster is empty or their query is too narrow.
 */
function EmptyRoster({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <Empty className="rounded-xl border border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Nobody matches</EmptyTitle>
          <EmptyDescription>
            {/*
             * `total` is the count *after* filtering, so it is zero here — the
             * useful number is the unfiltered one, and the facets already have
             * it above. Rather than fetch it again, say what to do.
             */}
            Nothing on this roster matches every filter at once. Narrowing by status and role
            together is the usual cause.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ClearFilters />
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="rounded-xl border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UserRoundPlus aria-hidden />
        </EmptyMedia>
        <EmptyTitle>Nobody here yet</EmptyTitle>
        <EmptyDescription>
          Accounts are invited, never self-served. Invite somebody and they appear straight away,
          marked <strong className="font-semibold text-[var(--warning)]">Invited</strong> until they
          follow their link.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/**
 * Five rows, matching the real table's rhythm.
 *
 * The header is real rather than shimmering: it does not depend on the data, so
 * animating it would suggest something is still arriving that is not.
 */
export function UsersTableSkeleton({ showRole = true }: { showRole?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card" aria-hidden>
      <ul className="flex flex-col md:hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index} className="flex items-start gap-3 border-b border-border p-4 last:border-b-0">
            <span className="size-9 shrink-0 animate-shimmer rounded-full bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
            <span className="flex grow flex-col gap-2">
              <span className="h-3.5 w-32 animate-shimmer rounded bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
              <span className="h-3 w-44 animate-shimmer rounded bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
              <span className="h-5 w-40 animate-shimmer rounded-full bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
            </span>
            <span className="size-8 shrink-0 animate-shimmer rounded-md bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {["Person", ...(showRole ? ["Role"] : []), "Status", "Joined"].map((heading) => (
              <TableHead
                key={heading}
                className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
              >
                {heading}
              </TableHead>
            ))}
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {Array.from({ length: 5 }, (_, index) => (
            <TableRow key={index}>
              <TableCell>
                <span className="flex items-center gap-3">
                  <span className="size-8 shrink-0 animate-shimmer rounded-full bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
                  <span className="flex flex-col gap-1.5">
                    <span className="h-3.5 w-32 animate-shimmer rounded bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
                    <span className="h-3 w-44 animate-shimmer rounded bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
                  </span>
                </span>
              </TableCell>
              {showRole && (
                <TableCell>
                  <span className="block h-5 w-16 animate-shimmer rounded-full bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
                </TableCell>
              )}
              <TableCell>
                <span className="block h-5 w-16 animate-shimmer rounded-full bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
              </TableCell>
              <TableCell>
                <span className="block h-3 w-24 animate-shimmer rounded bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
              </TableCell>
              <TableCell>
                <span className="ml-auto block size-8 animate-shimmer rounded-md bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <span className="h-3 w-40 animate-shimmer rounded bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
        <span className="h-8 w-48 animate-shimmer rounded bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
      </div>
    </div>
  );
}
