/**
 * The repository, against a real database.
 *
 * These are not unit tests and they are not meant to be. Everything they cover
 * is something only SQL can get wrong: three-valued logic on a nullable
 * `banned` column, `LIKE` wildcards arriving from a search box, and an
 * `ORDER BY` that pages correctly right up until two rows tie. None of it is
 * reachable from `service.test.ts`, and all of it is reachable from the screen.
 *
 * **These do not run by default here, and that is a real gap.** `@saas/db`
 * builds its client from `@libsql/client/web`, which speaks only HTTP — a
 * deliberate choice, because the same client runs in a Cloudflare Worker. It
 * cannot open `:memory:`, so there is no database this suite can conjure for
 * itself.
 *
 * Point `TEST_DATABASE_URL` at a libsql it may create tables in and the whole
 * suite runs:
 *
 *   turso dev --db-file .data/test.db          # or any http libsql
 *   TEST_DATABASE_URL=http://127.0.0.1:8080 bun run test
 *
 * It is skipped rather than deleted because what it covers — three-valued logic
 * on a nullable column, LIKE wildcards from a search box, an ORDER BY that
 * pages correctly until two rows tie — is reachable from the screen and from
 * nowhere else in the test suite.
 */

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

// Set before anything touches `db`: the client is built lazily on first query,
// so this is read then, not at import.
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

const { db, schema } = await import("@saas/db");
const { countUserFacets, countUsers, selectUsers } = await import("./repository");
const { normaliseFilters, orderFor, statusOf, toSummary } = await import("./service");

const MIGRATIONS = fileURLToPath(new URL("../../../../db/migrations", import.meta.url));

const ORG = "org_test";
const JOINED = new Date("2026-01-01T00:00:00Z");

type Seed = {
  id: string;
  name?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  banned?: boolean | null;
  role?: string | null;
  deletedAt?: Date | null;
};

async function insert(seed: Seed): Promise<void> {
  await db.insert(schema.user).values({
    id: seed.id,
    name: seed.name ?? seed.id,
    email: seed.email ?? `${seed.id}@example.com`,
    emailVerified: seed.emailVerified ?? true,
    banned: seed.banned ?? null,
    createdAt: JOINED,
    updatedAt: JOINED,
  });

  if (seed.role != null) {
    await db.insert(schema.member).values({
      id: `member_${seed.id}`,
      organizationId: ORG,
      userId: seed.id,
      role: seed.role,
      deletedAt: seed.deletedAt ?? null,
      createdAt: JOINED,
    });
  }
}

/** Every seeded row as the join hands it over, for cross-checking against SQL. */
async function everyRow() {
  return selectUsers({
    filters: normaliseFilters({}),
    order: orderFor("joined", "asc"),
    limit: 1000,
    offset: 0,
  });
}

beforeAll(async () => {
  if (!TEST_DATABASE_URL) return;
  const { sql } = await import("drizzle-orm");

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(join(MIGRATIONS, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    // Sequential on purpose: a migration that runs before the one that
    // creates its table is not a migration.
    // oxlint-disable-next-line no-await-in-loop
    for (const statement of statements) await db.run(sql.raw(statement));
  }

  await db.insert(schema.organization).values({
    id: ORG,
    name: "INTRIGO",
    slug: "intrigo",
    createdAt: JOINED,
  });

  await insert({ id: "staff_active", role: "staff" });
  await insert({ id: "manager_active", role: "manager" });
  await insert({ id: "staff_removed", role: "staff", deletedAt: new Date("2026-06-01") });
  await insert({ id: "staff_banned", role: "manager", banned: true });
  await insert({ id: "plugin_default", role: "member" });
  await insert({ id: "player_active" });
  await insert({ id: "player_invited", emailVerified: false });
  await insert({ id: "player_banned", banned: true });
  await insert({ id: "player_invited_banned", emailVerified: false, banned: true });
  await insert({ id: "percent", name: "Ada", email: "ada+100%off@example.com" });
});

const suite = TEST_DATABASE_URL ? describe : describe.skip;

suite("the status rule, in SQL and in TypeScript", () => {
  /*
   * The same rule is written twice — `STATUS_PREDICATES` here, `statusOf` in the
   * service — because filtering has to happen in the database for the page
   * counts to mean anything. This is the test that stops the two drifting: if
   * you change one and not the other, the counts stop matching the labels the
   * table is printing, which nobody would notice by looking.
   */
  test("agree on every seeded row", async () => {
    const rows = await everyRow();
    expect(rows.length).toBeGreaterThan(0);

    for (const status of ["active", "invited", "disabled"] as const) {
      const expected = rows.filter((row) => statusOf(row) === status).length;

      // oxlint-disable-next-line no-await-in-loop -- three queries, read in order
      const counted = await countUsers(normaliseFilters({ status }));

      // Reported as an object so a mismatch names the status that disagreed.
      expect({ status, count: counted }).toEqual({ status, count: expected });
    }
  });

  test("count only the population they were asked about", async () => {
    /*
     * Staff and players are separate screens, so a facet count spanning both
     * describes a list nobody is looking at: the staff page would offer
     * "Active · 39" above a table of six. Caught by nothing else — the numbers
     * are internally consistent, just about the wrong set of people.
     */
    const [everyone, staff, players] = await Promise.all([
      countUserFacets(),
      countUserFacets("staff"),
      countUserFacets("player"),
    ]);

    expect(staff.total).toBe(everyone.population.staff);
    expect(players.total).toBe(everyone.population.player);
    expect(staff.total + players.total).toBe(everyone.total);
    // And within a scope the statuses still partition it.
    expect(staff.status.active + staff.status.invited + staff.status.disabled).toBe(staff.total);
    expect(staff.population.player).toBe(0);
    expect(players.population.staff).toBe(0);
  });

  test("partition the roster — every row is counted exactly once", async () => {
    const facets = await countUserFacets();
    const { active, invited, disabled } = facets.status;

    expect(active + invited + disabled).toBe(facets.total);
    expect(facets.population.staff + facets.population.player).toBe(facets.total);
  });

  test("count a banned account that never signed in as disabled, not invited", async () => {
    const invited = await selectUsers({
      filters: normaliseFilters({ status: "invited" }),
      order: orderFor("joined", "asc"),
      limit: 100,
      offset: 0,
    });

    expect(invited.map((row) => row.id)).not.toContain("player_invited_banned");
  });

  test("count an untouched account as not banned", async () => {
    /*
     * `banned` is NULL for everybody who was never banned, and `NULL = 0` is
     * NULL, not true. A plain comparison drops almost the entire roster — and
     * it drops it from the *counts* too, so the table looks consistent while
     * being wrong.
     */
    const rows = await everyRow();
    const untouched = rows.filter((row) => row.banned === null);

    expect(untouched.length).toBeGreaterThan(0);
    expect(await countUsers(normaliseFilters({ status: "active" }))).toBeGreaterThan(0);
  });
});

suite("population", () => {
  test("keeps a removed member of staff among the staff", async () => {
    const staff = await selectUsers({
      filters: normaliseFilters({ population: "staff" }),
      order: orderFor("joined", "asc"),
      limit: 100,
      offset: 0,
    });

    expect(staff.map((row) => row.id)).toContain("staff_removed");
  });

  test("keeps an unrecognised membership role out of the players", async () => {
    const players = await selectUsers({
      filters: normaliseFilters({ population: "player" }),
      order: orderFor("joined", "asc"),
      limit: 100,
      offset: 0,
    });

    expect(players.map((row) => row.id)).not.toContain("plugin_default");
  });
});

suite("filtering by role", () => {
  test("counts an unrecognised membership role as a customer, matching the label", async () => {
    // `plugin_default` carries the organization plugin's `"member"`, which
    // `coerceRole` reports as `customer`. The filter has to agree with the
    // badge the table prints, or clicking "customer" hides a row that says it.
    const rows = await selectUsers({
      filters: normaliseFilters({ role: "customer" }),
      order: orderFor("joined", "asc"),
      limit: 100,
      offset: 0,
    });

    const ids = rows.map((row) => row.id);
    expect(ids).toContain("plugin_default");
    expect(ids).toContain("player_active");
    expect(ids).not.toContain("manager_active");
    expect(rows.every((row) => toSummary(row).role === "customer")).toBe(true);
  });

  test("matches a staff role exactly", async () => {
    const rows = await selectUsers({
      filters: normaliseFilters({ role: "manager" }),
      order: orderFor("joined", "asc"),
      limit: 100,
      offset: 0,
    });

    expect(rows.map((row) => row.id).sort()).toEqual(["manager_active", "staff_banned"]);
  });
});

suite("search", () => {
  test("treats a percent sign as text, not as a wildcard", async () => {
    /*
     * Searched on its own, `%` is the case that separates escaped from
     * unescaped: unescaped it becomes `%%%` and matches the entire roster, so
     * the filter appears to do nothing. Only one seeded address contains a
     * literal one.
     */
    const rows = await selectUsers({
      filters: normaliseFilters({ q: "%" }),
      order: orderFor("joined", "asc"),
      limit: 100,
      offset: 0,
    });

    expect(rows.map((row) => row.id)).toEqual(["percent"]);
  });

  test("treats an underscore as text, not as any-single-character", async () => {
    // `_` matches one of anything, so unescaped this finds every id that has a
    // character where the underscore is — which is almost all of them.
    const rows = await selectUsers({
      filters: normaliseFilters({ q: "player_invited" }),
      order: orderFor("joined", "asc"),
      limit: 100,
      offset: 0,
    });

    expect(rows.map((row) => row.id).sort()).toEqual(["player_invited", "player_invited_banned"]);
  });

  test("is case insensitive across name and email", async () => {
    const byName = await countUsers(normaliseFilters({ q: "ADA" }));
    expect(byName).toBe(1);
  });
});

suite("paging", () => {
  test("shows every row exactly once when the sort column ties", async () => {
    /*
     * The bug: rows sharing a sort key may come back in any order, and SQLite
     * does not promise the same order twice — so without the `id` tiebreak the
     * same row lands on two pages and another lands on none. Every seeded row
     * shares `joined`, which is exactly the default sort.
     */
    const filters = normaliseFilters({ sort: "joined", direction: "desc" });
    const total = await countUsers(filters);
    const pageSize = 3;
    const seen: string[] = [];

    for (let offset = 0; offset < total; offset += pageSize) {
      // oxlint-disable-next-line no-await-in-loop -- paging is sequential by nature
      const page = await selectUsers({
        filters,
        order: orderFor(filters.sort, filters.direction),
        limit: pageSize,
        offset,
      });
      seen.push(...page.map((row) => row.id));
    }

    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
  });
});
