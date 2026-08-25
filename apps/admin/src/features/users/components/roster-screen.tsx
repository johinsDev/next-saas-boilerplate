import { Suspense } from "react";
import { connection } from "next/server";
import type { Role } from "@saas/auth/roles";
import type { Population } from "@saas/services/users/schemas";

import { InviteModal, InviteTrigger } from "./invite-panel";
import { AttentionStrip } from "./attention-strip";
import { UsersFilters } from "./users-filters";
import { UsersTable, UsersTableSkeleton } from "./users-table";
import { readUserFacets } from "../users-queries";
import { loadUserSearchParams } from "../users-search-params";

/**
 * The body both rosters share.
 *
 * Staff and customers are separate screens — different columns, different
 * actions, different reasons to be there — but the frame around them is one
 * thing: a heading, an invite control, filters, and a table behind its own
 * boundary. Two copies of that would drift the first time one of them gained a
 * column.
 *
 * This bends the house rule that the *page* places the `<Suspense>`. It is
 * deliberate and narrow: the page still owns the shape by passing config, and
 * both pages stay synchronous, which is the part that actually matters under
 * `cacheComponents`. If a third roster ever wants a genuinely different layout,
 * it writes its own page rather than growing a flag here.
 */
export function RosterScreen({
  population,
  eyebrow,
  title,
  blurb,
  roles,
  menuRoles,
  fixedInviteRole,
  inviteLabel,
  searchParams,
}: {
  population: Population;
  eyebrow: string;
  title: string;
  blurb: string;
  /**
   * Roles this roster can be *filtered* by, which is also what decides whether
   * the Role column appears. Empty on a list where everybody holds the same
   * role — a filter with one useful position is not a filter.
   */
  roles?: readonly Role[];
  /**
   * Roles the row menu can *assign*. A different question: every roster can
   * move somebody anywhere, and doing so is how a customer becomes staff. The
   * row then leaves the screen it was changed on, which the toast says.
   */
  menuRoles?: readonly Role[];
  fixedInviteRole?: Role;
  inviteLabel: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-accent">
            {eyebrow}
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{blurb}</p>
        </div>

        <InviteTrigger label={inviteLabel} />
      </header>

      <InviteModal roles={roles} fixedRole={fixedInviteRole} />

      {/*
       * Two boundaries, not one. The filters need only the facet counts —
       * cached, one entry per roster — and the table needs the query; sharing
       * a boundary would hold the controls hostage to the slower of the two.
       */}
      {/*
       * Above the filters, because it is the answer to why the screen was
       * opened: something needs doing. It shares the facets boundary — one
       * cached read serves both, and splitting them would mean two.
       */}
      <Suspense fallback={<FiltersSkeleton hasRoles={Boolean(roles?.length)} />}>
        <Filters population={population} roles={roles} />
      </Suspense>

      <Suspense fallback={<UsersTableSkeleton showRole={Boolean(roles?.length)} />}>
        {searchParams.then(async (params) => {
          const { invite: _invite, ...filters } = await loadUserSearchParams(params);
          // The route decides the population; the URL cannot argue with it.
          return (
            <UsersTable
              filters={{ ...filters, population }}
              roles={roles}
              menuRoles={menuRoles}
            />
          );
        })}
      </Suspense>
    </div>
  );
}

/**
 * The controls read the facet counts, which are cached per population and do
 * not depend on `searchParams` at all. Their *values* come from the URL on the
 * client, via nuqs.
 *
 * `connection()` first, and it earns its place twice over.
 *
 * `readUserFacets` carries `use cache`, which makes it *prerenderable* — so
 * without this the build fills it by querying the database, and the whole app
 * stops building without one. A boilerplate that cannot be built from a fresh
 * clone is a boilerplate nobody gets past.
 *
 * The second reason is the better one: these are counts of live accounts. Baking
 * them into a build artifact means a deploy from Tuesday serves Tuesday's
 * numbers until the first revalidation, and nobody reading "Active · 39" above
 * a table of six would guess why.
 *
 * The cache is untouched — it fills on the first request instead of at build,
 * and the static shell around this boundary still prerenders.
 */
async function Filters({
  population,
  roles,
}: {
  population: Population;
  roles?: readonly Role[];
}) {
  await connection();

  const facets = await readUserFacets(population);

  return (
    <>
      <AttentionStrip facets={facets} />
      <UsersFilters facets={facets} roles={roles} />
    </>
  );
}

function FiltersSkeleton({ hasRoles }: { hasRoles: boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-3" aria-hidden>
      {["search:224", "status:160", ...(hasRoles ? ["role:160"] : [])].map((field) => (
        <div key={field} className="flex flex-col gap-1.5">
          <span className="block h-2.5 w-14 animate-shimmer rounded bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
          <span
            className="block h-9 animate-shimmer rounded-md bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none"
            style={{ width: Number(field.split(":")[1]) }}
          />
        </div>
      ))}
    </div>
  );
}
