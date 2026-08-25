/**
 * The contract for the people in the system, shared by every caller.
 *
 * Two populations live in one `user` table and always will: staff operate the
 * admin, players play the game. What separates them is not a column but a
 * `member` row, so every question about "which kind of person is this" is
 * answered by deriving rather than reading. That is the whole reason this file
 * exists — the derivations are stated once, here and in `service.ts`, instead
 * of being re-guessed at each call site.
 *
 * No zod. The dashboard reads and the admin writes through Better Auth's own
 * validated endpoints, so nothing here parses untrusted input. When
 * `apps/api` exposes this over HTTP it validates at its edge, which is where
 * untrusted input actually arrives.
 */

import type { Role } from "@saas/auth/roles";

/**
 * Which half of the product someone belongs to.
 *
 * Derived from the presence of a `member` row, never stored. Storing it would
 * create a second truth that can disagree with the row that actually grants
 * access — and the row is what the guard reads.
 */
export type Population = "staff" | "player";

export const POPULATIONS: readonly Population[] = ["staff", "player"];

/**
 * What state an account is in, as the roster shows it.
 *
 * Four, not three. `banned` and `removed` were one `disabled` until the roster
 * made the cost visible: both block access, and they are otherwise nothing
 * alike. A ban carries a reason, was set by somebody, and is *lifted*; a
 * removed membership carries no reason and is undone by assigning a role
 * again. One badge for both meant the screen could not tell you which had
 * happened, let alone what to do about it.
 *
 * `invited` means the address has never been proven: the account was created by
 * an invitation and nobody has followed the link yet. It is deliberately not a
 * separate table — see the invite flow. Signing in verifies the address, so an
 * invitation is accepted by the same act that proves it.
 *
 * Order matters here: it is the order the filter offers them, and it runs from
 * "nothing to do" to "most wrong".
 */
export type UserStatus = "active" | "invited" | "banned" | "removed";

export const USER_STATUSES: readonly UserStatus[] = ["active", "invited", "banned", "removed"];

/**
 * The statuses that are not `active`.
 *
 * The roster leads with a count of these — the reason anybody opens the screen
 * is that something needs doing, and deriving it here keeps the strip and the
 * filter from disagreeing.
 */
export const ATTENTION_STATUSES: readonly UserStatus[] = ["invited", "banned", "removed"];

/**
 * The sortable columns.
 *
 * Deliberately short. Every entry here is a column the repository must know how
 * to order by *and* keep stable, and an unstable sort is a bug that only shows
 * up past the first page — so the list grows one column at a time, with a test.
 */
export type UserSort = "name" | "email" | "role" | "joined";

export const USER_SORTS: readonly UserSort[] = ["name", "email", "role", "joined"];

export type SortDirection = "asc" | "desc";

export const SORT_DIRECTIONS: readonly SortDirection[] = ["asc", "desc"];

/**
 * Rows per page.
 *
 * Owned here rather than by the screen because the repository pages with it and
 * the service clamps against it — two places that must agree, and a screen that
 * disagreed would ask for a page the query cannot produce.
 */
export const PAGE_SIZE = 25;

/**
 * What the roster is being asked for. `null` on a facet means "not filtered",
 * which is not the same as a filter that matches nothing.
 */
export type UserFilters = {
  readonly q: string;
  readonly population: Population | null;
  readonly status: UserStatus | null;
  readonly role: Role | null;
  readonly sort: UserSort;
  readonly direction: SortDirection;
  /** 1-based, the way the URL shows it. Clamped by `normaliseFilters`. */
  readonly page: number;
};

export const DEFAULT_FILTERS: UserFilters = {
  q: "",
  population: null,
  status: null,
  role: null,
  sort: "joined",
  direction: "desc",
  page: 1,
};

/* ------------------------------------------------------------------ *
 * What the repository hands over.
 * ------------------------------------------------------------------ */

/**
 * One row of the `user` ⟕ `member` join.
 *
 * `membership` is an object or `null` rather than a flat `memberRole: string |
 * null`, because those two are not the same question. A member row can carry a
 * role we do not recognise (the organization plugin defaults it to `"member"`),
 * and flattening would make "no row" and "unrecognised role" indistinguishable
 * — collapsing a member of staff into a player.
 */
export type UserJoinRow = {
  readonly id: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly image: string | null;
  readonly emailVerified: boolean;
  readonly banned: boolean | null;
  readonly banReason: string | null;
  readonly createdAt: Date;
  readonly membership: {
    readonly role: string;
    /** Soft delete. Still a member of staff — a removed one. */
    readonly deletedAt: Date | null;
  } | null;
};

/* ------------------------------------------------------------------ *
 * What the service reports.
 * ------------------------------------------------------------------ */

/** A row of the users table, and nothing more than a row of it needs. */
export type UserSummary = {
  readonly id: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly image: string | null;
  readonly population: Population;
  readonly role: Role;
  readonly status: UserStatus;
  readonly banReason: string | null;
  readonly joinedAt: Date;
};

export type UserPage = {
  readonly users: readonly UserSummary[];
  /** Matching the filters, not the page. */
  readonly total: number;
  readonly page: number;
  /** At least 1, even with nothing to show. "Page 1 of 0" is not a thing. */
  readonly pageCount: number;
  readonly pageSize: number;
};

/**
 * The counts beside each filter.
 *
 * Unfiltered on purpose: they answer "how many are there of each kind", which
 * is the question a filter control is asking. Counting within the current
 * filters would make every number change as you narrow, and the control would
 * stop telling you what you would get by clicking it.
 */
export type UserFacets = {
  readonly population: Readonly<Record<Population, number>>;
  readonly status: Readonly<Record<UserStatus, number>>;
  readonly total: number;
};

/** One user, as their own page shows them. */
export type UserDetail = UserSummary & {
  readonly emailVerified: boolean;
  readonly sessions: readonly UserSession[];
};

export type UserSession = {
  readonly id: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  /** Set while somebody is impersonating this account. */
  readonly impersonatedBy: string | null;
};

/* ------------------------------------------------------------------ *
 * Ordering.
 * ------------------------------------------------------------------ */

/** A column to order by. `id` is the tiebreak and never appears alone. */
export type OrderKey = {
  readonly column: UserSort | "id";
  readonly direction: SortDirection;
};
