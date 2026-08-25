import { describe, expect, test } from "vitest";

import { DEFAULT_FILTERS, PAGE_SIZE, type UserJoinRow } from "./schemas";
import {
  normaliseFilters,
  orderFor,
  paginate,
  planMembershipChange,
  populationOf,
  roleOf,
  statusOf,
  toSummary,
} from "./service";

/**
 * These rules decide who appears on the roster, what they are called, and
 * whether the page you are looking at is the page the URL claims. Getting one
 * wrong shows an operator a list that is quietly incomplete, which is worse
 * than showing them nothing.
 */

function row(overrides: Partial<UserJoinRow> = {}): UserJoinRow {
  return {
    id: "user_1",
    name: "Ada",
    email: "ada@example.com",
    image: null,
    emailVerified: true,
    banned: null,
    banReason: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    membership: null,
    ...overrides,
  };
}

describe("populationOf", () => {
  test("a member row makes somebody staff", () => {
    expect(populationOf(row({ membership: { role: "staff", deletedAt: null } }))).toBe("staff");
  });

  test("no member row makes somebody a player", () => {
    expect(populationOf(row())).toBe("player");
  });

  test("a removed member of staff is still staff", () => {
    /*
     * Soft delete removes access, not history. Letting `deletedAt` flip the
     * population would move a dismissed employee into the players list, where
     * whoever is auditing what they did would never think to look.
     */
    const removed = row({
      membership: { role: "manager", deletedAt: new Date("2026-06-01T00:00:00Z") },
    });

    expect(populationOf(removed)).toBe("staff");
  });

  test("an unrecognised member role is still staff", () => {
    // The organization plugin defaults `member.role` to "member", which is not
    // one of ours. The row's existence is what makes them staff, not its value.
    expect(populationOf(row({ membership: { role: "member", deletedAt: null } }))).toBe("staff");
  });
});

describe("roleOf", () => {
  test("reads the role off the member row", () => {
    expect(roleOf(row({ membership: { role: "manager", deletedAt: null } }))).toBe("manager");
  });

  test("a player has no member row and is a customer", () => {
    expect(roleOf(row())).toBe("customer");
  });

  test("an unrecognised role falls back to the least privilege", () => {
    expect(roleOf(row({ membership: { role: "member", deletedAt: null } }))).toBe("customer");
  });
});

describe("statusOf", () => {
  test("a verified, unbanned account is active", () => {
    expect(statusOf(row())).toBe("active");
  });

  test("an account that has never proven its address is invited", () => {
    expect(statusOf(row({ emailVerified: false }))).toBe("invited");
  });

  test("a banned account is disabled", () => {
    expect(statusOf(row({ banned: true }))).toBe("disabled");
  });

  test("a removed member of staff is disabled", () => {
    const removed = row({
      membership: { role: "staff", deletedAt: new Date("2026-06-01T00:00:00Z") },
    });

    expect(statusOf(removed)).toBe("disabled");
  });

  test("being banned beats never having signed in", () => {
    /*
     * Both are true of somebody invited and then banned before they clicked.
     * Reporting "invited" would put them in the list of people we are waiting
     * on, and somebody would helpfully resend the invitation.
     */
    expect(statusOf(row({ emailVerified: false, banned: true }))).toBe("disabled");
  });
});

describe("toSummary", () => {
  test("carries the ban reason so the table can say why", () => {
    const summary = toSummary(row({ banned: true, banReason: "Left the company" }));

    expect(summary.status).toBe("disabled");
    expect(summary.banReason).toBe("Left the company");
  });

  test("does not leak a stale ban reason once somebody is active again", () => {
    // Better Auth leaves `banReason` behind on unban. Rendering it beside an
    // active account would accuse somebody of something that was undone.
    const summary = toSummary(row({ banned: false, banReason: "Left the company" }));

    expect(summary.status).toBe("active");
    expect(summary.banReason).toBeNull();
  });
});

describe("paginate", () => {
  test("reports one page when there is nothing to show", () => {
    // "Page 1 of 0" is not a thing anybody can read.
    expect(paginate(0, 1, PAGE_SIZE)).toEqual({ page: 1, pageCount: 1, offset: 0 });
  });

  test("clamps a page past the end onto the last real page", () => {
    // Reachable by deleting rows while somebody has page 4 open. Without the
    // clamp they get an empty table under a control that says the page exists.
    const { page, offset } = paginate(60, 99, PAGE_SIZE);

    expect(page).toBe(3);
    expect(offset).toBe(50);
  });

  test("never produces a negative offset", () => {
    for (const asked of [0, -1, -999]) {
      expect(paginate(60, asked, PAGE_SIZE).offset).toBe(0);
    }
  });

  test("survives a page that is not a number", () => {
    expect(paginate(60, Number.NaN, PAGE_SIZE)).toEqual({ page: 1, pageCount: 3, offset: 0 });
  });

  test("counts a partial last page", () => {
    expect(paginate(51, 1, PAGE_SIZE).pageCount).toBe(3);
  });
});

describe("orderFor", () => {
  test("always breaks ties on the id", () => {
    /*
     * The bug this exists to prevent: SQLite may return rows in any order among
     * equal sort keys, so the same row can appear on two pages and another on
     * none. Invisible with five users, certain with two hundred.
     */
    for (const sort of ["name", "email", "role", "joined"] as const) {
      const keys = orderFor(sort, "asc");

      expect(keys.length).toBeGreaterThan(1);
      expect(keys.at(-1)).toEqual({ column: "id", direction: "asc" });
    }
  });

  test("applies the asked-for direction to the asked-for column only", () => {
    const [first, ...rest] = orderFor("name", "desc");

    expect(first).toEqual({ column: "name", direction: "desc" });
    // The tiebreak stays ascending whichever way the column goes: it exists to
    // be deterministic, not to be meaningful.
    expect(rest).toEqual([{ column: "id", direction: "asc" }]);
  });
});

describe("normaliseFilters", () => {
  test("fills in the defaults", () => {
    expect(normaliseFilters({})).toEqual(DEFAULT_FILTERS);
  });

  test("trims the search text", () => {
    expect(normaliseFilters({ q: "  ada  " }).q).toBe("ada");
  });

  test("floors a fractional page rather than passing it to SQL", () => {
    expect(normaliseFilters({ page: 2.7 }).page).toBe(2);
  });

  test("refuses a sort column it does not know how to order by", () => {
    // Straight off the URL, so it is whatever anybody types.
    expect(normaliseFilters({ sort: "password" as never }).sort).toBe(DEFAULT_FILTERS.sort);
  });

  test("refuses an unknown population, status or role", () => {
    const filters = normaliseFilters({
      population: "ghost" as never,
      status: "pending" as never,
      role: "superuser" as never,
    });

    expect(filters.population).toBeNull();
    expect(filters.status).toBeNull();
    expect(filters.role).toBeNull();
  });

  test("keeps the facets it does recognise", () => {
    const filters = normaliseFilters({ population: "staff", status: "disabled", role: "manager" });

    expect(filters.population).toBe("staff");
    expect(filters.status).toBe("disabled");
    expect(filters.role).toBe("manager");
  });
});

describe("planMembershipChange", () => {
  /**
   * Changing somebody's role is not one write, and the difference matters:
   * `member` is what grants access, so getting this wrong either strands a
   * promotion or quietly restores access somebody had taken away.
   */
  const serving = { role: "staff", deletedAt: null } as const;
  const removed = { role: "staff", deletedAt: new Date("2026-06-01T00:00:00Z") } as const;

  test("promoting a player creates the membership they do not have", () => {
    expect(planMembershipChange(null, "staff")).toEqual({ kind: "create", role: "staff" });
  });

  test("leaving a player as a customer writes nothing", () => {
    expect(planMembershipChange(null, "customer")).toEqual({ kind: "none" });
  });

  test("demoting staff to customer removes the membership rather than storing the word", () => {
    /*
     * `customer` is the absence of a membership, not a value `member.role` can
     * hold — `getUserRole` reads the row and would report `customer` for it
     * anyway. Writing the string would leave a row that grants nothing and
     * still says "staff" to anyone reading the table directly.
     */
    expect(planMembershipChange(serving, "customer")).toEqual({ kind: "remove" });
  });

  test("re-hiring a removed member of staff restores the row", () => {
    expect(planMembershipChange(removed, "manager")).toEqual({ kind: "update", role: "manager" });
  });

  test("restores a removed member even when the role is unchanged", () => {
    // Same role, so a naive equality check writes nothing — and the person
    // stays locked out while the screen shows them back at their old role.
    expect(planMembershipChange(removed, "staff")).toEqual({ kind: "update", role: "staff" });
  });

  test("writes nothing when a serving member is set to the role they already hold", () => {
    expect(planMembershipChange(serving, "staff")).toEqual({ kind: "none" });
  });

  test("writes nothing when somebody already removed is set to customer", () => {
    expect(planMembershipChange(removed, "customer")).toEqual({ kind: "none" });
  });
});
