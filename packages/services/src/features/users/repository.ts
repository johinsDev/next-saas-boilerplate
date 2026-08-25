/**
 * Rows in, rows out. No rules.
 *
 * One caveat worth stating loudly: **the status predicates below and `statusOf`
 * in `service.ts` are the same rule written twice**, once in SQL and once in
 * TypeScript. They have to be — filtering has to happen in the database or the
 * page counts lie — but that makes them the one place in this slice where a
 * change to one side can silently disagree with the other. `repository.test.ts`
 * runs both against the same rows for exactly that reason. If you edit one,
 * edit the other, and watch that test.
 *
 * v1 assumes a single operator organization, so the join to `member` is
 * unqualified: a user has at most one membership row. Multi-tenancy narrows it
 * by `session.activeOrganizationId` here, and in `getUserRole`, together.
 */

import { db, schema } from "@saas/db";
import { STAFF_OR_ABOVE } from "@saas/auth/roles";
import {
  and,
  asc,
  desc,
  eq,
  isNotNull,
  isNull,
  notInArray,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";

import type {
  OrderKey,
  Population,
  UserFacets,
  UserFilters,
  UserJoinRow,
  UserSession,
} from "./schemas";

const { user, member, session } = schema;

/**
 * `banned` is nullable — Better Auth only writes it when somebody is banned —
 * so a plain `= 0` misses every account that was never touched. Three-valued
 * logic is why the roster would otherwise show a handful of its users.
 */
const BANNED = sql`coalesce(${user.banned}, 0) = 1`;
const NOT_BANNED = sql`coalesce(${user.banned}, 0) = 0`;

/** True for a player as well as a serving member of staff: no row, no deletion. */
const NOT_REMOVED = isNull(member.deletedAt);

const STATUS_PREDICATES = {
  disabled: or(BANNED, isNotNull(member.deletedAt))!,
  invited: and(NOT_BANNED, NOT_REMOVED, eq(user.emailVerified, false))!,
  active: and(NOT_BANNED, NOT_REMOVED, eq(user.emailVerified, true))!,
} as const;

/**
 * `%` and `_` are wildcards in `LIKE`, so an unescaped search for "100%" matches
 * every row and looks like the filter is broken rather than over-eager.
 */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function whereFor(filters: UserFilters): SQL | undefined {
  const clauses: SQLWrapper[] = [];

  if (filters.q) {
    const pattern = likePattern(filters.q.toLowerCase());
    clauses.push(
      or(
        sql`lower(${user.name}) like ${pattern} escape '\\'`,
        sql`lower(${user.email}) like ${pattern} escape '\\'`,
      )!,
    );
  }

  if (filters.population === "staff") clauses.push(isNotNull(member.id));
  if (filters.population === "player") clauses.push(isNull(member.id));

  if (filters.status) clauses.push(STATUS_PREDICATES[filters.status]);

  if (filters.role === "customer") {
    /*
     * "Customer" is the floor, not a stored value: it covers everybody with no
     * membership AND anybody whose membership carries a role we do not
     * recognise. `coerceRole` makes the same call in TypeScript, and a filter
     * that disagreed with it would hide rows the table is already labelling
     * "customer".
     */
    clauses.push(or(isNull(member.id), notInArray(member.role, [...STAFF_OR_ABOVE]))!);
  } else if (filters.role) {
    clauses.push(eq(member.role, filters.role));
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}

const SORT_COLUMNS = {
  name: user.name,
  email: user.email,
  role: member.role,
  joined: user.createdAt,
  id: user.id,
} as const;

function orderBy(order: readonly OrderKey[]): SQL[] {
  return order.map(({ column, direction }) =>
    direction === "asc" ? asc(SORT_COLUMNS[column]) : desc(SORT_COLUMNS[column]),
  );
}

/** The columns every read of this join needs, named once. */
const COLUMNS = {
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
  emailVerified: user.emailVerified,
  banned: user.banned,
  banReason: user.banReason,
  createdAt: user.createdAt,
  memberId: member.id,
  memberRole: member.role,
  memberDeletedAt: member.deletedAt,
} as const;

/**
 * What `db.select(COLUMNS)` hands back, written out rather than derived.
 *
 * A mapped type over `COLUMNS` looks tidier and does not survive the outer
 * join: drizzle widens the `member` columns to nullable itself, and a hand
 * rolled mapping cannot see that.
 */
type Selected = {
  readonly id: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly image: string | null;
  readonly emailVerified: boolean;
  readonly banned: boolean | null;
  readonly banReason: string | null;
  readonly createdAt: Date;
  readonly memberId: string | null;
  readonly memberRole: string | null;
  readonly memberDeletedAt: Date | null;
};

/**
 * `memberId`, not `memberRole`, decides whether there is a membership. The role
 * column is `NOT NULL`, so a null role can only come from the outer join — but
 * saying so through the primary key makes that impossible to get wrong if the
 * column ever gains a default.
 */
function toJoinRow(row: Selected): UserJoinRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    emailVerified: row.emailVerified,
    banned: row.banned,
    banReason: row.banReason,
    createdAt: row.createdAt,
    membership:
      row.memberId === null
        ? null
        : { role: row.memberRole ?? "", deletedAt: row.memberDeletedAt },
  };
}

export async function selectUsers({
  filters,
  order,
  limit,
  offset,
}: {
  filters: UserFilters;
  order: readonly OrderKey[];
  limit: number;
  offset: number;
}): Promise<readonly UserJoinRow[]> {
  const rows = await db
    .select(COLUMNS)
    .from(user)
    .leftJoin(member, eq(member.userId, user.id))
    .where(whereFor(filters))
    .orderBy(...orderBy(order))
    .limit(limit)
    .offset(offset);

  return rows.map(toJoinRow);
}

export async function countUsers(filters: UserFilters): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(user)
    .leftJoin(member, eq(member.userId, user.id))
    .where(whereFor(filters));

  return row?.total ?? 0;
}

/**
 * Every facet count in one round trip.
 *
 * Six separate counts would be six scans of the same join for numbers that must
 * add up to each other — and if one of them ran against a table somebody was
 * writing to, they would not.
 *
 * `population` narrows the whole tally. Staff and players are separate screens,
 * and a status count that included the other roster would say "Active · 39" on
 * a page showing six people.
 */
export async function countUserFacets(population?: Population): Promise<UserFacets> {
  const tally = (predicate: SQL) => sql<number>`sum(case when ${predicate} then 1 else 0 end)`;

  const scope =
    population === "staff"
      ? isNotNull(member.id)
      : population === "player"
        ? isNull(member.id)
        : undefined;

  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      staff: tally(isNotNull(member.id)),
      player: tally(isNull(member.id)),
      active: tally(STATUS_PREDICATES.active),
      invited: tally(STATUS_PREDICATES.invited),
      disabled: tally(STATUS_PREDICATES.disabled),
    })
    .from(user)
    .leftJoin(member, eq(member.userId, user.id))
    .where(scope);

  return {
    total: row?.total ?? 0,
    population: { staff: row?.staff ?? 0, player: row?.player ?? 0 },
    status: {
      active: row?.active ?? 0,
      invited: row?.invited ?? 0,
      disabled: row?.disabled ?? 0,
    },
  };
}

export async function selectUser(id: string): Promise<UserJoinRow | null> {
  const [row] = await db
    .select(COLUMNS)
    .from(user)
    .leftJoin(member, eq(member.userId, user.id))
    .where(eq(user.id, id))
    .limit(1);

  return row ? toJoinRow(row) : null;
}

/**
 * The sessions that would still let somebody in.
 *
 * Expired rows are excluded rather than shown greyed out: the only reason to
 * look at this list is to decide what to revoke, and a row that cannot be used
 * is a row that invites a pointless click.
 */
export async function selectUserSessions(userId: string): Promise<readonly UserSession[]> {
  const rows = await db
    .select({
      id: session.id,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      impersonatedBy: session.impersonatedBy,
    })
    .from(session)
    .where(and(eq(session.userId, userId), sql`${session.expiresAt} > unixepoch()`))
    .orderBy(desc(session.createdAt));

  return rows;
}

/* ------------------------------------------------------------------ *
 * Writes.
 * ------------------------------------------------------------------ */

export async function selectMembership(
  userId: string,
): Promise<{ role: string; deletedAt: Date | null } | null> {
  const [row] = await db
    .select({ role: member.role, deletedAt: member.deletedAt })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1);

  return row ?? null;
}

export async function insertMembership(input: {
  userId: string;
  organizationId: string;
  role: string;
}): Promise<void> {
  await db.insert(member).values({
    id: `member_${crypto.randomUUID()}`,
    userId: input.userId,
    organizationId: input.organizationId,
    role: input.role,
    createdAt: new Date(),
  });
}

/** Sets the role and lifts any soft delete. The two are one decision — see `planMembershipChange`. */
export async function updateMembership(userId: string, role: string): Promise<void> {
  await db.update(member).set({ role, deletedAt: null }).where(eq(member.userId, userId));
}

/**
 * Soft delete. The row stays so the audit trail keeps pointing at somebody, and
 * so a re-hire restores rather than re-creates.
 */
export async function softDeleteMembership(userId: string): Promise<void> {
  await db.update(member).set({ deletedAt: new Date() }).where(eq(member.userId, userId));
}

export async function selectUserIdByEmail(email: string): Promise<string | null> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${email.toLowerCase()}`)
    .limit(1);

  return row?.id ?? null;
}

/**
 * Creates the account an invitation is for.
 *
 * `emailVerified: false` is load-bearing, not a default: it is what makes the
 * roster report them as `invited`, and following the magic link is what flips
 * it. The invitation is accepted by the same act that proves the address, which
 * is why there is no second table to reconcile.
 */
export async function insertInvitedUser(input: {
  email: string;
  name: string | null;
}): Promise<string> {
  const id = `user_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(user).values({
    id,
    email: input.email,
    name: input.name ?? input.email.split("@")[0] ?? input.email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}
