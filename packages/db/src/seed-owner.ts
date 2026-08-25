/**
 * Hands somebody the keys to the admin.
 *
 * Magic-link sign-in runs with `disableSignUp: true` — staff are invited, never
 * self-served — so there has to be one deliberate way to create the first
 * owner. This is it, and it is a script rather than a code path in the app: a
 * "promote the first user who shows up" rule stays alive in production forever,
 * and whoever arrives after the table is next emptied inherits the site.
 *
 *   bun run db:seed:owner owner@acme.example
 */

import { eq } from "drizzle-orm";

import { db } from "./client";
import { member, organization, user } from "./schema";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The value Better Auth's `admin` plugin looks for in `user.role`. */
const ADMIN_CAPABILITY = "admin";

const DEFAULT_ORGANIZATION = { id: "org_acme", name: "Acme", slug: "acme" } as const;

type Existing = {
  readonly email: string;
  readonly user: { readonly id: string; readonly role: string | null } | null;
  readonly organization: { readonly id: string } | null;
  readonly member: { readonly role: string } | null;
};

export type OwnerSeedPlan = {
  readonly email: string;
  readonly userId: string | null;
  readonly organizationId: string | null;
  readonly createUser: boolean;
  readonly createOrganization: boolean;
  readonly createMember: boolean;
  readonly promote: boolean;
  /**
   * Whether to set `user.role = "admin"`.
   *
   * NOT the same thing as `member.role`, however much the names suggest it.
   * `member.role` is our authorization ladder; this is Better Auth's `admin`
   * plugin capability flag, and it is the only thing that plugin checks before
   * allowing impersonation, ban, and session revocation. An owner without it is
   * an owner whose admin screen answers 403 on every row action.
   */
  readonly grantAdminCapability: boolean;
};

/**
 * Decides what to write, before writing anything.
 *
 * Split out so the decision is testable without a database, and so the rule
 * that matters is stated in one place: **the seed only ever raises a role.**
 * Re-running it must never take access away from someone who was promoted by
 * hand, and it will be re-run — every local database reset needs it.
 */
export function planOwnerSeed(existing: Existing): OwnerSeedPlan {
  if (!EMAIL.test(existing.email)) {
    throw new Error(`"${existing.email}" is not an email address`);
  }

  return {
    email: existing.email,
    userId: existing.user?.id ?? null,
    organizationId: existing.organization?.id ?? null,
    createUser: existing.user === null,
    createOrganization: existing.organization === null,
    createMember: existing.member === null,
    promote: existing.member !== null && existing.member.role !== "owner",
    grantAdminCapability: existing.user?.role !== ADMIN_CAPABILITY,
  };
}

async function seedOwner(email: string): Promise<void> {
  const [foundUser] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  const [foundOrg] = await db.select({ id: organization.id }).from(organization).limit(1);

  const organizationId = foundOrg?.id ?? DEFAULT_ORGANIZATION.id;
  const userId = foundUser?.id ?? `user_${crypto.randomUUID()}`;

  const [foundMember] = foundUser
    ? await db
        .select({ role: member.role })
        .from(member)
        .where(eq(member.userId, foundUser.id))
        .limit(1)
    : [];

  const plan = planOwnerSeed({
    email,
    user: foundUser ?? null,
    organization: foundOrg ?? null,
    member: foundMember ?? null,
  });

  if (plan.createOrganization) {
    await db.insert(organization).values({ ...DEFAULT_ORGANIZATION, createdAt: new Date() });
  }

  if (plan.createUser) {
    await db.insert(user).values({
      id: userId,
      email,
      name: email.split("@")[0] ?? email,
      emailVerified: true,
      role: ADMIN_CAPABILITY,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else if (plan.grantAdminCapability) {
    await db.update(user).set({ role: ADMIN_CAPABILITY }).where(eq(user.id, userId));
  }

  if (plan.createMember) {
    await db.insert(member).values({
      id: `member_${crypto.randomUUID()}`,
      userId,
      organizationId,
      role: "owner",
      createdAt: new Date(),
    });
  } else if (plan.promote) {
    await db.update(member).set({ role: "owner" }).where(eq(member.userId, userId));
  }

  const what = plan.createMember ? "seeded" : plan.promote ? "promoted" : "already an owner";
  process.stdout.write(`${email} — ${what} (organization ${organizationId})\n`);
}

if (import.meta.main) {
  const email = process.argv[2];
  if (!email) {
    process.stderr.write("usage: bun run db:seed:owner <email>\n");
    process.exit(1);
  }
  await seedOwner(email);
}
