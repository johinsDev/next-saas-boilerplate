---
name: auth
description: Role-based authorization for the next-saas-boilerplate monorepo. Use when adding a new protected route, gating a route handler or /api handler by role, defining who can do what, seeding the first owner, or onboarding a teammate to "how does auth work here". Sits on top of Better Auth's organization plugin.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# auth — RBAC for the next-saas-boilerplate monorepo

Better Auth gives us **sessions + an `organization` plugin** with a `member.role` text column. Everything else (canonical roles, gating procedures, gating routes, gating /api handlers) lives in this monorepo and is documented here. Read this before you write a single `an authenticated route` for a feature that's not 100% public.

---

## The role model

Four roles, defined once in `packages/auth/src/roles.ts`:

| Role | Member row? | Where they sign in | What they can do |
| --- | --- | --- | --- |
| `customer` | no | apps/web (phone OTP or Google) | Use the next-saas-boilerplate PWA — see card, redeem rewards, manage profile |
| `staff` | yes | apps/admin (Google) | Cashier ops: add stamps, look up customers |
| `manager` | yes | apps/admin (Google) | Staff + invite/manage staff, configure rewards, read reports |
| `owner` | yes | apps/admin (Google) | Manager + dev tooling (outboxes, smoke pages) |

**The defaults**:
- A user with NO `member` row is a `customer`. Customers don't need to be in any organization — that's intentional, makes signup cheap.
- A `member` row with an unknown `role` value is degraded to `customer` (`coerceRole`). Least privilege.
- Web is the customer surface. Admin is staff+. Dev tooling inside admin is owner-only.
- **One organization in v1**: `t4-diverplaza` (slug) / `T4 Diverplaza` (display name). All staff/manager/owner roles are members of this org. When the SaaS goes multi-tenant, the org id flows from `session.activeOrganizationId` and the helpers stay the same.

---

## Where things live

| What | Where |
| --- | --- |
| Role constants + types | `packages/auth/src/roles.ts` |
| `getUserRole(userId)` | `packages/auth/src/server.ts` |
| route handlers (`a staff-guarded route` / `a manager-guarded route` / `an owner-guarded route`) | `apps/api/src/lib/` |
| Server Component guards (`requireSession` / `requireRole`) | `apps/{web,admin}/src/lib/auth-guard.ts` |
| /api Route Handler guards | `packages/auth/src/api-guard.ts` |
| Sign-in forbidden banner | `apps/{web,admin}/src/features/auth/components/sign-in-form.tsx` |
| Bootstrap owner CLI | `packages/db/src/seed-owner.ts` (run via `bun run db:seed:owner`) |

---

## The four layers of defense

Use them in this order. Each layer is opt-in for the feature — only protect a route as tightly as it needs.

### 1) `proxy.ts` (cookie-only redirect)

Cheapest. Reads the Better Auth session cookie. Redirects unauthenticated traffic to `/sign-in` BEFORE the React tree renders.

```ts
// apps/{web,admin}/proxy.ts
import { getSessionCookie } from "better-auth/cookies";

const session = getSessionCookie(request);
if (!session) return NextResponse.redirect(/* /sign-in */);
```

**What it checks**: presence of a signed session cookie. **What it does NOT check**: validity of that cookie (it might be expired/revoked), or any role.

Better Auth's docs are explicit: *"This is NOT SECURE — we recommend handling auth checks in each page/route."* The proxy is an **optimistic** edge gate, not a security boundary. Keep the role check in layer 2.

### 2) Server Component / layout — `requireSession` / `requireRole`

The real gate. Server-side, hits the DB to validate the session and resolve the role.

```tsx
// apps/admin/app/[locale]/(dashboard)/customers/page.tsx
import { requireRole } from "@/lib/auth-guard";
import { STAFF_OR_ABOVE } from "@saas/auth/server";

export default async function CustomersPage() {
  const { session, role } = await requireRole(STAFF_OR_ABOVE);
  // role is typed: "staff" | "manager" | "owner"
  return <CustomersList currentRole={role} />;
}
```

If the user isn't signed in → `redirect("/sign-in")`. If the user is signed in but doesn't have the role → `redirect("/sign-in?error=forbidden")` (the sign-in page shows an amber banner explaining what happened).

For layouts that wrap an entire route group (e.g. `(dev)/layout.tsx` admin), put the `requireRole(OWNER_ONLY)` call there so every page in the group is gated by default.

### 3) route handler — `a staff-guarded route` / `a manager-guarded route` / `an owner-guarded route`

Server-side enforcement for queries + mutations. Use these instead of `an authenticated route` when a feature isn't open to plain customers.

```ts
// packages/api/src/features/rewards/router.ts
import { a manager-guarded route, router } from "../../the API";

export const rewardsRouter = router({
  create: a manager-guarded route.input(createSchema).mutation(({ ctx, input }) => {
    // ctx.session.user is the manager; ctx.role is typed Role
    return service.create(input);
  }),
});
```

The middleware throws `ServiceError({ code: "FORBIDDEN" })` for sessions whose role isn't allowed; Hono RPC turns that into a 403 the client can branch on (the `useMutation` `error.data?.code === "FORBIDDEN"`).

### 4) `/api/*` Route Handler — `requireApiRole`

For raw Next.js route handlers (no Hono RPC).

```ts
// apps/admin/app/api/whatsapp-outbox/route.ts
import { requireApiRole } from "@saas/auth/api-guard";
import { OWNER_ONLY } from "@saas/auth/server";

export async function GET(req: Request) {
  const auth = await requireApiRole(req, OWNER_ONLY);
  if (!auth.ok) return auth.response;
  // auth.session.user.id available; auth.role typed
  return Response.json(await listOutbox());
}
```

The helper returns a discriminated union — on failure, the caller returns the pre-built 401/403 `NextResponse`. No throw ceremony.

---

## Decision tree: which layer should I use?

```
Is the action user-mutating or data-reading?
├── Both — use Hono RPC. Replace `an authenticated route` with `a staff-guarded route` /
│         `a manager-guarded route` / `an owner-guarded route` based on the audience.
│         Never gate at the route level only — if the page is missing the
│         guard, the procedure still rejects.
│
└── Page render only (no per-action mutation, e.g. an admin dashboard) —
    use a layout-level `requireRole`. One gate covers every page in the
    route group.

Need an /api route (webhooks, custom handlers, file uploads)?
└── Always wrap with `requireApiSession` or `requireApiRole`. Never trust
    the proxy alone — webhooks can hit the API path directly without
    going through next-intl middleware.
```

Default to **belt and suspenders**: layout `requireRole` AND procedure `a staff-guarded route`. The proxy is the third belt.

---

## How to gate a new feature

### Customer-only feature (apps/web)

```tsx
// apps/web/app/[locale]/redeem/page.tsx
import { requireSession } from "@/lib/auth-guard";

export default async function RedeemPage() {
  await requireSession();  // any signed-in user is a customer-or-above
  return <Redeem />;
}
```

Procedures: `an authenticated route` (already covers any signed-in user — no role check needed).

### Staff feature (admin)

```tsx
// apps/admin/app/[locale]/(dashboard)/sellos/page.tsx
import { STAFF_OR_ABOVE } from "@saas/auth/server";
import { requireRole } from "@/lib/auth-guard";

export default async function SellosPage() {
  await requireRole(STAFF_OR_ABOVE);
  return <AddStampForm />;
}
```

Procedures: `a staff-guarded route`.

### Manager-only

```ts
import { a manager-guarded route } from "../../the API";
a manager-guarded route.mutation(({ ctx }) => { ... });
```

### Owner-only (dev tooling)

```ts
// apps/admin/app/[locale]/(dev)/layout.tsx
await requireRole(OWNER_ONLY);
```

Procedures: `an owner-guarded route`. /api handlers: `requireApiRole(req, OWNER_ONLY)`.

---

## Bootstrap the first owner

The role model is opt-in (no member row = customer). Until someone is explicitly seeded as owner, dev tooling is inaccessible.

```bash
# 1. Sign up the user first (apps/web /sign-in or apps/admin /sign-in)
# 2. Then promote them:
bun run db:seed:owner --email=johinsdev@gmail.com
```

The script:
- Creates the singleton `t4-diverplaza` organization (name "T4 Diverplaza") if it doesn't exist
- Inserts (or updates) the user's `member` row with `role=owner`
- Idempotent — safe to re-run

Run once per environment (local Neon, Vercel preview DB, Vercel prod DB).

For staff and manager: extend the script later with `--role=staff|manager` or build the invite-staff UI inside admin.

---

## Antipatterns — don't do these

- **Don't hard-code user IDs or emails** in code to grant access (`if (user.id === "user_xxx") return true`). Roles are the only authorization signal. Once you add hard-coded specials, every deploy is a rotation risk.
- **Don't use `a public route` for anything that mutates state of a signed-in user**. Even if the data is "harmless to read", `a public route` means *no auth at all* — the caller's session isn't even loaded. If the caller needs to be someone, use `an authenticated route` at minimum.
- **Don't rely on `proxy.ts` for authorization**. The cookie is unsigned-from-the-edge's-perspective: only its presence is checked, not whether the session is still valid. Always re-check in the layout/procedure.
- **Don't add role checks based on email patterns** (`if (email.endsWith("@t4.app"))`). Same issue as hard-coded IDs but with extra rot — email domains change.
- **Don't query `member` directly** in feature code — use `getUserRole(userId)`. Future-proofs against the schema growing (e.g., when multi-tenancy adds `organizationId` filtering).
- **Don't write a custom auth middleware in a router**. Use `a staff-guarded route` / `a manager-guarded route` / `an owner-guarded route`. If those don't fit, talk before you fork.

---

## Common pitfalls

- **Forgot to seed an owner** → can't access admin `(dev)` routes. Symptom: redirect-loop or `error=forbidden` banner. Fix: run `bun run db:seed:owner --email=...`.
- **Customer signed in to admin** → first time they hit any staff-only page, redirected to `/sign-in?error=forbidden`. The session itself is valid — they just don't have the role. Expected behavior; don't try to "fix" this by promoting them.
- **Role cached in cookie** — we don't do this in v1. Each `requireRole` does one DB query (~1ms when Neon is warm). If a layout call is in a hot path, optimize there, not by inventing a JWT claim.
- **`(dev)` layout doesn't gate**: confirm the layout calls `requireRole(OWNER_ONLY)` first, BEFORE `setRequestLocale`. The redirect needs to happen before any RSC fetches that might leak data.
- **Same role expected on both web and admin** — yes, customers can in theory log in to admin and they'll be redirected to sign-in?error=forbidden. Same the other way around: an owner who tries to log into web sees the regular customer experience (their role doesn't enable anything in web).

---

## See also

- Better Auth's official Next.js doc: https://better-auth.com/docs/integrations/next — confirms the patterns above (cookie-only middleware, server-component-level session check, etc.)
- `.claude/skills/architecture-guard/SKILL.md` — feature folder structure (where role-gated routers go)
- `.claude/skills/better-auth-best-practices/SKILL.md` — Better Auth library reference (sessions, plugins, schema)
