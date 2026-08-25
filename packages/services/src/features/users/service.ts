/**
 * The rules that turn `user` ⟕ `member` rows into a roster.
 *
 * Everything above the composed reads at the bottom is a pure function of its
 * arguments — no request, no cache, no framework — because the same code runs
 * in the Next server, in the Hono Worker and in a plain `vitest` process. The
 * caching lives one layer up, in each app's `-queries.ts`.
 */

import { ALL_ROLES, ROLES, coerceRole, type Role } from "@saas/auth/roles";

import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  POPULATIONS,
  USER_SORTS,
  USER_STATUSES,
  SORT_DIRECTIONS,
  type OrderKey,
  type Population,
  type SortDirection,
  type UserDetail,
  type UserFacets,
  type UserFilters,
  type UserJoinRow,
  type UserPage,
  type UserSort,
  type UserStatus,
  type UserSummary,
} from "./schemas";
import { ServiceError } from "../_shared/errors";
import {
  countUserFacets,
  countUsers,
  insertInvitedUser,
  insertMembership,
  selectMembership,
  selectUser,
  selectUserIdByEmail,
  selectUserSessions,
  selectUsers,
  softDeleteMembership,
  updateMembership,
} from "./repository";

/* ------------------------------------------------------------------ *
 * Deriving what a row means.
 * ------------------------------------------------------------------ */

/**
 * Staff or player, decided by whether a `member` row exists at all.
 *
 * Not by what the row says. The organization plugin writes `"member"` by
 * default, which is not one of our roles, and reading the value here would
 * quietly file a member of staff among the players.
 */
export function populationOf(row: UserJoinRow): Population {
  return row.membership === null ? "player" : "staff";
}

/** The authorization role. No membership means `customer`, the floor. */
export function roleOf(row: UserJoinRow): Role {
  return row.membership === null ? ROLES.customer : coerceRole(row.membership.role);
}

/**
 * What state the account is in.
 *
 * The order is the rule, and every line of it earns its place:
 *
 * A ban outranks a removed membership because it is the one carrying a reason
 * and the one that has to be lifted first — restoring a role under a standing
 * ban would look like it worked and change nothing.
 *
 * And both outrank `invited`. Somebody invited and then banned before they
 * clicked satisfies two conditions at once, and answering "invited" would file
 * them among the people we are waiting on — where the helpful thing to do is
 * resend an invitation to somebody we deliberately shut out.
 */
export function statusOf(row: UserJoinRow): UserStatus {
  if (row.banned === true) return "banned";
  if (row.membership?.deletedAt != null) return "removed";
  if (!row.emailVerified) return "invited";
  return "active";
}

export function toSummary(row: UserJoinRow): UserSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    population: populationOf(row),
    role: roleOf(row),
    status: statusOf(row),
    /*
     * Only while the ban stands. Better Auth leaves `banReason` behind when an
     * account is unbanned, so reading the column directly would print the
     * reason somebody *was* shut out beside an account that is working fine.
     */
    banReason: row.banned === true ? row.banReason : null,
    joinedAt: row.createdAt,
  };
}

/* ------------------------------------------------------------------ *
 * Paging and ordering.
 * ------------------------------------------------------------------ */

export type Pagination = {
  readonly page: number;
  readonly pageCount: number;
  readonly offset: number;
};

/**
 * Where the asked-for page actually lands.
 *
 * Every value here is about to become a `LIMIT`/`OFFSET`, and the page number
 * arrives from the URL, so it is whatever anybody typed. A negative offset, a
 * fractional one, or one past the end all produce an empty table underneath a
 * control insisting the page exists.
 */
export function paginate(total: number, page: number, pageSize = PAGE_SIZE): Pagination {
  // At least one, so a roster with nothing in it still reads "page 1 of 1".
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const asked = Number.isFinite(page) ? Math.floor(page) : 1;
  const safe = Math.min(Math.max(asked, 1), pageCount);

  return { page: safe, pageCount, offset: (safe - 1) * pageSize };
}

/**
 * The columns to order by, tiebreak included.
 *
 * The tiebreak is the point. SQLite is free to return rows in any order among
 * equal sort keys, and it does not have to pick the same order twice — so
 * without a unique last column, paging by `LIMIT`/`OFFSET` can show one row on
 * two pages and another on none. It is invisible on the five rows you develop
 * against and certain on the two hundred you ship.
 */
export function orderFor(sort: UserSort, direction: SortDirection): readonly OrderKey[] {
  return [
    { column: sort, direction },
    // Ascending whichever way the column goes: it is here to be deterministic,
    // not to mean anything.
    { column: "id", direction: "asc" },
  ];
}

/* ------------------------------------------------------------------ *
 * Filters.
 * ------------------------------------------------------------------ */

function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * Fills in the defaults and drops anything unrecognised.
 *
 * These values come off a query string, so "unrecognised" is the normal case,
 * not the exceptional one. An unknown facet becomes `null` — not filtered —
 * rather than being coerced onto a valid value: `?role=superuser` silently
 * listing customers would be a worse answer than ignoring it.
 */
export function normaliseFilters(raw: Partial<UserFilters>): UserFilters {
  return {
    q: (raw.q ?? "").trim(),
    population: oneOf(POPULATIONS, raw.population),
    status: oneOf(USER_STATUSES, raw.status),
    role: oneOf(ALL_ROLES, raw.role),
    sort: oneOf(USER_SORTS, raw.sort) ?? DEFAULT_FILTERS.sort,
    direction: oneOf(SORT_DIRECTIONS, raw.direction) ?? DEFAULT_FILTERS.direction,
    page: Number.isFinite(raw.page) ? Math.max(1, Math.floor(raw.page as number)) : 1,
  };
}

/* ------------------------------------------------------------------ *
 * Writes.
 * ------------------------------------------------------------------ */

export type MembershipChange =
  | { readonly kind: "none" }
  | { readonly kind: "create"; readonly role: Role }
  /** Sets the role and clears any soft delete — the two are one decision. */
  | { readonly kind: "update"; readonly role: Role }
  | { readonly kind: "remove" };

/**
 * What changing somebody's role actually writes.
 *
 * Three things make this more than an `UPDATE`:
 *
 * `customer` is the **absence** of a membership, not a value the column can
 * hold. `getUserRole` reports `customer` for any row it does not recognise, so
 * writing the word would leave a row that grants nothing and still reads
 * "staff" to anybody looking at the table directly.
 *
 * Setting a role has to **clear the soft delete**, or re-hiring somebody
 * updates the row they cannot use and leaves them locked out while the screen
 * shows them restored.
 *
 * And "same role" is not the same as "no change" — a removed member set back to
 * the role they already held is precisely the re-hire case.
 */
export function planMembershipChange(
  existing: { readonly role: string; readonly deletedAt: Date | null } | null,
  next: Role,
): MembershipChange {
  if (next === ROLES.customer) {
    // Already gone, or never there.
    if (existing === null || existing.deletedAt !== null) return { kind: "none" };
    return { kind: "remove" };
  }

  if (existing === null) return { kind: "create", role: next };
  if (existing.deletedAt !== null) return { kind: "update", role: next };

  return coerceRole(existing.role) === next ? { kind: "none" } : { kind: "update", role: next };
}

/* ------------------------------------------------------------------ *
 * The composed reads. These are what an app calls.
 * ------------------------------------------------------------------ */

/**
 * One page of the roster.
 *
 * Counts first, then reads. That costs a second query and buys the clamp: the
 * page number has to be validated against a total before it can become an
 * offset, and asking for page 4 of a 3-page roster is something the URL can do
 * at any moment.
 */
export async function getUserPage(raw: Partial<UserFilters>): Promise<UserPage> {
  const filters = normaliseFilters(raw);
  const total = await countUsers(filters);
  const { page, pageCount, offset } = paginate(total, filters.page);

  const rows = await selectUsers({
    filters,
    order: orderFor(filters.sort, filters.direction),
    limit: PAGE_SIZE,
    offset,
  });

  return { users: rows.map(toSummary), total, page, pageCount, pageSize: PAGE_SIZE };
}

/**
 * The counts beside the filter controls.
 *
 * Unfiltered *within* a population — see `UserFacets` — but scoped to one,
 * because staff and players are separate screens and a count spanning both
 * describes a list nobody is looking at.
 */
export async function getUserFacets(population?: Population): Promise<UserFacets> {
  return countUserFacets(population);
}

/** One user, with their live sessions. `null` when there is no such id. */
export async function getUser(id: string): Promise<UserDetail | null> {
  const row = await selectUser(id);
  if (!row) return null;

  return {
    ...toSummary(row),
    emailVerified: row.emailVerified,
    sessions: await selectUserSessions(id),
  };
}

/**
 * Applies a role change and reports what it actually did.
 *
 * The caller gets the plan back rather than a boolean so the audit entry can
 * say which of the four things happened. "Role changed" written against a
 * no-op is worse than no entry at all.
 */
export async function changeUserRole(input: {
  userId: string;
  role: Role;
  organizationId: string;
}): Promise<MembershipChange> {
  const change = planMembershipChange(await selectMembership(input.userId), input.role);

  switch (change.kind) {
    case "create":
      await insertMembership({
        userId: input.userId,
        organizationId: input.organizationId,
        role: change.role,
      });
      break;
    case "update":
      await updateMembership(input.userId, change.role);
      break;
    case "remove":
      await softDeleteMembership(input.userId);
      break;
    case "none":
      break;
  }

  return change;
}

/**
 * Creates the account behind an invitation.
 *
 * Refuses an address that already has one rather than quietly adjusting it. The
 * two look the same from the invite form and are not: silently re-roling an
 * existing account from a box labelled "invite" is how somebody gets promoted
 * by a typo. The roster row is where a role gets changed.
 */
export async function inviteUser(input: {
  email: string;
  name: string | null;
  role: Role;
  organizationId: string;
}): Promise<{ userId: string }> {
  const email = input.email.trim().toLowerCase();

  if (await selectUserIdByEmail(email)) {
    throw new ServiceError({
      code: "CONFLICT",
      message: "That address already has an account. Change their role from the roster instead.",
    });
  }

  const userId = await insertInvitedUser({ email, name: input.name });

  if (input.role !== ROLES.customer) {
    await insertMembership({ userId, organizationId: input.organizationId, role: input.role });
  }

  return { userId };
}
