import { describe, expect, test } from "vitest";
import { planOwnerSeed } from "./seed-owner";

/**
 * The seed decides what to write before it writes anything, so the decision can
 * be tested without a database. What matters is that running it twice is safe:
 * this is the one command that hands somebody the keys, and it will be run
 * again every time a developer resets their local database.
 */

const EMAIL = "owner@acme.example";

describe("planOwnerSeed", () => {
  test("creates the user, the organization and the membership on an empty database", () => {
    const plan = planOwnerSeed({ email: EMAIL, user: null, organization: null, member: null });

    expect(plan.createUser).toBe(true);
    expect(plan.createOrganization).toBe(true);
    expect(plan.createMember).toBe(true);
    expect(plan.promote).toBe(false);
  });

  test("reuses the user who already signed in with Google", () => {
    const plan = planOwnerSeed({
      email: EMAIL,
      user: { id: "user_1", role: "admin" },
      organization: { id: "org_1" },
      member: null,
    });

    expect(plan.createUser).toBe(false);
    expect(plan.createOrganization).toBe(false);
    expect(plan.createMember).toBe(true);
    expect(plan.userId).toBe("user_1");
    expect(plan.organizationId).toBe("org_1");
  });

  test("changes nothing when the owner is already seeded", () => {
    const plan = planOwnerSeed({
      email: EMAIL,
      user: { id: "user_1", role: "admin" },
      organization: { id: "org_1" },
      member: { role: "owner" },
    });

    expect(plan.createUser).toBe(false);
    expect(plan.createOrganization).toBe(false);
    expect(plan.createMember).toBe(false);
    expect(plan.promote).toBe(false);
  });

  test("promotes an existing member who is not an owner yet", () => {
    const plan = planOwnerSeed({
      email: EMAIL,
      user: { id: "user_1", role: "admin" },
      organization: { id: "org_1" },
      member: { role: "staff" },
    });

    expect(plan.createMember).toBe(false);
    expect(plan.promote).toBe(true);
  });

  test("never demotes an owner back down", () => {
    /*
     * The seed only ever raises. If it could lower a role, re-running it after
     * someone was promoted by hand would quietly take their access away.
     */
    const plan = planOwnerSeed({
      email: EMAIL,
      user: { id: "user_1", role: "admin" },
      organization: { id: "org_1" },
      member: { role: "owner" },
    });

    expect(plan.promote).toBe(false);
  });

  test("refuses an address that is not an email", () => {
    expect(() => planOwnerSeed({ email: "not-an-email", user: null, organization: null, member: null }))
      .toThrow(/email/i);
  });
});

/**
 * The owner also needs Better Auth's `admin` plugin capability flag.
 *
 * Two different things are called "role" here, and conflating them is what this
 * guards. `member.role` is our authorization ladder (customer → owner);
 * `user.role` is the plugin's capability flag, and it is the ONLY thing it
 * checks before allowing impersonation, ban and session revocation. Seeding an
 * owner who cannot impersonate is a seed that looks like it worked.
 */
describe("planOwnerSeed — the admin capability flag", () => {
  test("grants the flag when creating the user from scratch", () => {
    const plan = planOwnerSeed({ email: EMAIL, user: null, organization: null, member: null });

    expect(plan.grantAdminCapability).toBe(true);
  });

  test("grants the flag to a user who signed in with Google before being seeded", () => {
    // This is the real database as of today: the owner exists, `user.role` is
    // NULL, and every admin-plugin endpoint answers 403.
    const plan = planOwnerSeed({
      email: EMAIL,
      user: { id: "user_1", role: null },
      organization: { id: "org_1" },
      member: { role: "owner" },
    });

    expect(plan.grantAdminCapability).toBe(true);
  });

  test("leaves the flag alone when it is already set", () => {
    const plan = planOwnerSeed({
      email: EMAIL,
      user: { id: "user_1", role: "admin" },
      organization: { id: "org_1" },
      member: { role: "owner" },
    });

    expect(plan.grantAdminCapability).toBe(false);
  });
});
