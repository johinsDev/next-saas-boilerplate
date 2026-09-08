import type { Database } from "@saas/db";
import { describe, expect, it } from "vitest";

import { accountExists } from "./server";

/**
 * Same shape as the fake in `packages/services` — the query builder is a chain
 * that resolves to rows, so a handful of self-returning methods stands in for
 * a database.
 */
function fakeDb(rows: unknown[]): Database {
  const result = {
    from: () => result,
    where: () => result,
    limit: () => Promise.resolve(rows),
  };
  return { select: () => result } as unknown as Database;
}

/**
 * This guard is what stops the magic-link endpoint from mailing strangers.
 *
 * With `disableSignUp` a link to an address with no account is unredeemable,
 * so sending it accomplishes nothing except letting anyone make this server
 * mail arbitrary addresses — from your domain, on your quota. Better Auth's
 * per-IP rate limit does not cover it: rotating the address stays under any
 * per-IP cap, and rotating the IP defeats the cap outright.
 */
describe("accountExists", () => {
  it("is true when a user row matches", async () => {
    expect(
      await accountExists(fakeDb([{ id: "u_1" }]), "owner@example.com"),
    ).toBe(true);
  });

  it("is false when nothing matches", async () => {
    expect(await accountExists(fakeDb([]), "nobody@example.com")).toBe(false);
  });
});
