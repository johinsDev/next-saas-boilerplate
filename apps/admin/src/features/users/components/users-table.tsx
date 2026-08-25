import {
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
import { RoleBadge, StatusBadge } from "./user-badges";
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

  if (users.length === 0) return <EmptyRoster />;

  // The route the rows link to. Staff and customers have their own detail pages
  // so the sidebar keeps highlighting the section you are actually in.
  const base = filters.population === "player" ? "customers" : "staff";
  const showRole = Boolean(roles?.length);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
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
      <TableCell>
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
        <span className="flex flex-col gap-1">
          <StatusBadge status={user.status} />
          {user.banReason && (
            <span className="text-[11px] text-muted-foreground">{user.banReason}</span>
          )}
        </span>
      </TableCell>

      <TableCell className="text-xs tabular-nums text-muted-foreground">
        {/*
         * A fixed locale and UTC. `toLocaleDateString()` with neither reads the
         * server's, so the same row renders one day earlier or later depending
         * on where it was rendered — and it mismatches between the server and
         * the client, which React reports as a hydration error.
         */}
        {user.joinedAt.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })}
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

function initials(label: string): string {
  const [first = "", second = ""] = label.replace(/@.*/, "").split(/[\s._-]+/);
  return ((first[0] ?? "") + (second[0] ?? "")).trim() || label.slice(0, 2);
}

/**
 * Says which of two situations this is.
 *
 * "No users" and "no users matching that" call for completely different next
 * moves, and one message for both leaves whoever is looking to work out which
 * they are in.
 */
function EmptyRoster() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <p className="text-sm font-semibold text-foreground">Nobody matches those filters</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
        Clear a filter, or invite somebody. An account only appears here once it exists — invitations
        create one straight away, so an invited person shows up before they have signed in.
      </p>
    </div>
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
                  <span className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
                  <span className="flex flex-col gap-1.5">
                    <span className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                    <span className="h-3 w-44 animate-pulse rounded bg-muted" />
                  </span>
                </span>
              </TableCell>
              {showRole && (
                <TableCell>
                  <span className="block h-5 w-16 animate-pulse rounded-full bg-muted" />
                </TableCell>
              )}
              <TableCell>
                <span className="block h-5 w-16 animate-pulse rounded-full bg-muted" />
              </TableCell>
              <TableCell>
                <span className="block h-3 w-24 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell>
                <span className="ml-auto block size-8 animate-pulse rounded-md bg-muted" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <span className="h-3 w-40 animate-pulse rounded bg-muted" />
        <span className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
