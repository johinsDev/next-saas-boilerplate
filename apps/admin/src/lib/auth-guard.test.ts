import { describe, expect, test } from "vitest";
import { ROLES } from "@saas/auth";

import { decideAccess, MINIMUM_ADMIN_ROLE } from "./auth-guard";

/**
 * The only thing between the open internet and the admin. The decision is a
 * pure function precisely so it can be pinned down without a request, a session
 * or a database.
 */

const STAFF = { userId: "u1" } as const;

describe("decideAccess", () => {
  test("sends an anonymous visitor to sign-in, carrying where they were going", () => {
    const decision = decideAccess({
      session: null,
      role: null,
      minimum: MINIMUM_ADMIN_ROLE,
      pathname: "/members",
    });

    expect(decision).toEqual({ kind: "redirect", to: "/sign-in?next=%2Fmembers" });
  });

  test("refuses an absolute URL as the return path", () => {
    // `?next=https://evil.example` would make the sign-in form an open redirect.
    const decision = decideAccess({
      session: null,
      role: null,
      minimum: MINIMUM_ADMIN_ROLE,
      pathname: "//evil.example/steal",
    });

    expect(decision).toEqual({ kind: "redirect", to: "/sign-in" });
  });

  test("forbids a signed-in visitor whose role is below the bar", () => {
    // A customer has a perfectly valid session. That is the whole reason the
    // cookie check in `proxy.ts` cannot be the last word.
    const decision = decideAccess({
      session: STAFF,
      role: ROLES.customer,
      minimum: MINIMUM_ADMIN_ROLE,
      pathname: "/members",
    });

    expect(decision).toEqual({ kind: "forbidden", role: ROLES.customer });
  });

  test("treats a missing membership row as customer, not as staff", () => {
    const decision = decideAccess({
      session: STAFF,
      role: null,
      minimum: MINIMUM_ADMIN_ROLE,
      pathname: "/",
    });

    expect(decision.kind).toBe("forbidden");
  });

  test("lets staff through and hands back the role, so nobody looks it up twice", () => {
    const decision = decideAccess({
      session: STAFF,
      role: ROLES.staff,
      minimum: MINIMUM_ADMIN_ROLE,
      pathname: "/",
    });

    expect(decision).toEqual({ kind: "allow", role: ROLES.staff });
  });

  test("lets a role above the bar through", () => {
    const decision = decideAccess({
      session: STAFF,
      role: ROLES.owner,
      minimum: MINIMUM_ADMIN_ROLE,
      pathname: "/",
    });

    expect(decision).toEqual({ kind: "allow", role: ROLES.owner });
  });

  test("the bar is real: raising it turns the same viewer away", () => {
    const input = { session: STAFF, role: ROLES.staff, pathname: "/" } as const;

    expect(decideAccess({ ...input, minimum: ROLES.staff }).kind).toBe("allow");
    expect(decideAccess({ ...input, minimum: ROLES.owner }).kind).toBe("forbidden");
  });
});
