/**
 * Development seed.
 *
 * Run against a local/preview database only:
 *   DATABASE_URL=http://127.0.0.1:8080 bun run db:seed
 *
 * Idempotent: every insert is keyed on a deterministic id and skips on
 * conflict, so re-running after adding a table does not duplicate rows.
 *
 * **Two organizations, deliberately.** A single-org seed lets every
 * multi-tenancy bug through untouched — most of them only appear when one user
 * belongs to two organizations and the code has to pick the *right* one rather
 * than the *first* one. `owner@example.com` is a member of both, with a
 * different role in each, so a query that resolves membership by user id alone
 * (instead of by user id AND organization id) returns the wrong role here
 * instead of in production.
 */
import { eq } from "drizzle-orm";

import { createDb } from "./client";
import {
  member,
  organization,
  organizationSettings,
  user,
} from "./schema";

// Deterministic ids: re-running the seed is a no-op, and tests can hard-code
// them without first reading the database.
const ORG_PRIMARY = "seed-org-primary";
const ORG_SECONDARY = "seed-org-secondary";
const USER_OWNER = "seed-user-owner";
const USER_STAFF = "seed-user-staff";

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@example.com";
const STAFF_EMAIL = process.env.SEED_STAFF_EMAIL ?? "staff@example.com";

async function main() {
  const db = createDb();
  const now = new Date();

  await db
    .insert(organization)
    .values([
      { id: ORG_PRIMARY, name: "Acme Inc", slug: "acme", createdAt: now },
      { id: ORG_SECONDARY, name: "Globex", slug: "globex", createdAt: now },
    ])
    .onConflictDoNothing();

  await db
    .insert(user)
    .values([
      {
        id: USER_OWNER,
        name: "Ada Owner",
        email: OWNER_EMAIL,
        emailVerified: true,
        // Better Auth `admin` plugin capability flag — NOT the app role.
        // Only the owner carries it, so only they can impersonate/ban.
        role: "admin",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: USER_STAFF,
        name: "Sam Staff",
        email: STAFF_EMAIL,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(member)
    .values([
      // The dual membership. Different roles on purpose: resolving membership
      // without the organization id yields "owner" in Globex, which is wrong.
      {
        id: "seed-member-owner-primary",
        organizationId: ORG_PRIMARY,
        userId: USER_OWNER,
        role: "owner",
        createdAt: now,
      },
      {
        id: "seed-member-owner-secondary",
        organizationId: ORG_SECONDARY,
        userId: USER_OWNER,
        role: "manager",
        createdAt: now,
      },
      // Single-org member: the control case.
      {
        id: "seed-member-staff-primary",
        organizationId: ORG_PRIMARY,
        userId: USER_STAFF,
        role: "staff",
        createdAt: now,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(organizationSettings)
    .values([
      {
        id: "seed-settings-primary",
        organizationId: ORG_PRIMARY,
        defaultLocale: "en",
        supportedLocales: ["en", "es"],
        currency: "USD",
        timezone: "UTC",
        primaryColor: "#2563EB",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "seed-settings-secondary",
        organizationId: ORG_SECONDARY,
        defaultLocale: "es",
        supportedLocales: ["es", "en"],
        currency: "COP",
        timezone: "America/Bogota",
        primaryColor: "#16A34A",
        createdAt: now,
        updatedAt: now,
      },
    ])
    .onConflictDoNothing();

  const orgs = await db.select({ slug: organization.slug }).from(organization);
  const memberships = await db
    .select({ role: member.role })
    .from(member)
    .where(eq(member.userId, USER_OWNER));

  console.info(
    `Seeded ${orgs.length} organizations (${orgs.map((o) => o.slug).join(", ")}); ` +
      `${OWNER_EMAIL} holds ${memberships.length} memberships ` +
      `(${memberships.map((m) => m.role).join(", ")}).`,
  );
}

await main();
