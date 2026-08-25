/**
 * Sample people, so the roster can actually be tested.
 *
 * There is no game yet and no `apps/web`, so the players half of the roster is
 * empty — and an empty table cannot be verified. Filters, sorting, the page
 * clamp and the tiebreak are all things that behave correctly on five rows and
 * wrongly on two hundred, which is the whole reason this exists.
 *
 *   bun run db:seed:demo          # add them
 *   bun run db:seed:demo --clear  # take them away again
 *
 * **Every row it writes is prefixed `demo_`**, and that is the safety rule:
 * `--clear` deletes exactly what this file created and can never touch a real
 * account. It also makes them obvious in the database — nobody is going to
 * mistake `demo_player_07` for a person.
 *
 * Deterministic on purpose. Re-running writes the same ids, so it is idempotent
 * without needing to ask what is already there, and two developers looking at
 * "the same" roster really are.
 */

import { like } from "drizzle-orm";

import { db } from "./client";
import { member, organization, user } from "./schema";

const PREFIX = "demo_";

const FIRST = [
  "Ada", "Bruno", "Carmen", "Diego", "Elena", "Farid", "Greta", "Hugo",
  "Ines", "Jonas", "Kira", "Lucas", "Marta", "Nadia", "Omar", "Paula",
  "Quim", "Rita", "Samir", "Tomas", "Ursula", "Viktor", "Wanda", "Xavi",
  "Yara", "Zeno",
];

const LAST = [
  "Alvarez", "Bianchi", "Costa", "Duarte", "Esteban", "Ferreira", "Gomez",
  "Haddad", "Ibarra", "Jansen", "Klein", "Lozano", "Moreau", "Novak",
];

/** Staff, written out rather than generated: there are five and they mean different things. */
const STAFF: readonly { id: string; name: string; role: string; state: State }[] = [
  { id: "manager_01", name: "Renata Salas", role: "manager", state: "active" },
  { id: "staff_01", name: "Iker Bonet", role: "staff", state: "active" },
  { id: "staff_02", name: "Noor Rahimi", role: "staff", state: "invited" },
  { id: "staff_03", name: "Cleo Ferrer", role: "staff", state: "banned" },
  { id: "staff_04", name: "Aldo Prieto", role: "staff", state: "removed" },
];

type State = "active" | "invited" | "banned" | "removed";

/**
 * Which state each player is in, by position.
 *
 * A repeating pattern rather than a random draw: it guarantees every status is
 * represented on the first page *and* somewhere deep in the list, so paging
 * through a status filter exercises more than one page.
 */
const PLAYER_STATES: readonly State[] = ["active", "active", "active", "invited", "banned"];

/**
 * One base date, stepped by whole days.
 *
 * Fixed rather than `Date.now()`, so the sort order is the same on every
 * machine — and so `joined` has real ties to break. Every fifth row shares its
 * day with the one before it, which is exactly the case the `id` tiebreak
 * exists for.
 */
const BASE = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;

function joinedAt(index: number): Date {
  return new Date(BASE + Math.floor(index / 2) * DAY);
}

async function clear(): Promise<void> {
  // Members first: the FK points this way, and SQLite will not always tell you.
  await db.delete(member).where(like(member.userId, `${PREFIX}%`));
  const removed = await db.delete(user).where(like(user.id, `${PREFIX}%`)).returning({ id: user.id });

  process.stdout.write(`removed ${removed.length} demo accounts\n`);
}

async function seed(): Promise<void> {
  const [org] = await db.select({ id: organization.id }).from(organization).limit(1);

  if (!org) {
    process.stderr.write(
      "No organization yet. Run `bun run db:seed:owner <email>` first — the demo staff need one to belong to.\n",
    );
    process.exit(1);
  }

  // Re-runnable: clear what a previous run wrote rather than colliding on ids.
  await clear();

  const rows: {
    id: string;
    name: string;
    email: string;
    state: State;
    role: string | null;
  }[] = [];

  STAFF.forEach((person) => {
    rows.push({
      id: `${PREFIX}${person.id}`,
      name: person.name,
      email: `${person.name.toLowerCase().replace(/\s+/g, ".")}@acme.example`,
      state: person.state,
      role: person.role,
    });
  });

  for (let index = 0; index < 60; index += 1) {
    const first = FIRST[index % FIRST.length]!;
    const last = LAST[index % LAST.length]!;

    rows.push({
      id: `${PREFIX}player_${String(index).padStart(2, "0")}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${index}@players.example`,
      state: PLAYER_STATES[index % PLAYER_STATES.length]!,
      role: null,
    });
  }

  await db.insert(user).values(
    rows.map((row, index) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      // `invited` is the absence of a verified address — the same rule the
      // roster derives its badge from, not a parallel flag.
      emailVerified: row.state !== "invited",
      banned: row.state === "banned" ? true : null,
      banReason: row.state === "banned" ? "Sample data" : null,
      createdAt: joinedAt(index),
      updatedAt: joinedAt(index),
    })),
  );

  const memberships = rows.filter((row) => row.role !== null);

  if (memberships.length > 0) {
    await db.insert(member).values(
      memberships.map((row) => ({
        id: `${PREFIX}member_${row.id}`,
        userId: row.id,
        organizationId: org.id,
        role: row.role!,
        deletedAt: row.state === "removed" ? new Date(BASE + 200 * DAY) : null,
        createdAt: joinedAt(0),
      })),
    );
  }

  process.stdout.write(
    `seeded ${rows.length} demo accounts (${memberships.length} staff, ${rows.length - memberships.length} players)\n`,
  );
}

if (import.meta.main) {
  if (process.argv.includes("--clear")) await clear();
  else await seed();
}

export { clear as clearDemoUsers };
