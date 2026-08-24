# next-saas-boilerplate

The infrastructure a SaaS needs before it has a product: provider-agnostic packages for
storage, email, SMS, push, cache, rate limiting, analytics, feature flags, realtime and
background jobs, plus auth, a database layer, and 81 UI components.

Extracted from a production application, with its domain removed.

**[ROADMAP.md](./ROADMAP.md) is the honest list of what is missing** — billing and
entitlements above all.

## Getting started

```bash
bun install
bun run typecheck     # 22 workspaces
bun run test
bun run --cwd apps/api dev
```

`apps/api` is here. `apps/web`, `apps/admin` and the Astro landing are not — see
ROADMAP §1.

## Layout

```
apps/
  api         Hono on Cloudflare Workers. Exports `AppType` for `hc<AppType>`.

packages/
  db          Drizzle + libSQL/Turso. Auth, audit, outboxes, notifications, settings.
  auth        Better Auth: Google, magic link, phone OTP, organizations, roles, impersonation.
  services    The service layer. Every caller goes through here.
  ui          81 Base UI + Tailwind components. Web only.

  cache · rate-limit · storage · email · email-templates · sms · whatsapp · push ·
  notifications · analytics · feature-flags · realtime · shortlinks · log · date ·
  address · jobs
```

## The shape every provider package takes

One port, several adapters, a fake for tests, and a manager that picks the adapter from
configuration. `@saas/storage` speaks S3, R2 or the local disk; `@saas/cache` speaks
Upstash, Redis or memory; `@saas/sms` speaks Twilio or a folder you can read.

The payoff is that swapping a vendor is a config change and testing never needs one.
Every package ships a fake with assertions — `FakeRealtime.assertPublished(...)` — so a
test asserts on behaviour instead of on a mock.

## Data access

**Web and admin call `packages/services` directly** from Server Components and Server
Actions. They do not call the API over HTTP.

The reason is concrete: the Next apps run on Vercel and the API runs on Cloudflare
Workers. A Server Component fetching its own API would leave Vercel, cross the public
internet, and come back — for data it could read in the same process. That is pure
latency, a second serialisation, and a second auth check, for nothing. The API exists
for clients that are not our server: mobile, and one day third parties.

Mobile uses **Hono RPC** (`hc<AppType>`), a type-only import: the bundle gets the
contract at compile time and ships no client at runtime.

```ts
import { hc } from "hono/client";
import type { AppType } from "@saas/api";   // type-only: 0 bytes shipped

const api = hc<AppType>(url);
const res = await api.organizations[":id"].settings.$get({ param: { id } });
```

`AppType` is inferred from the **route chain** in `apps/api/src/index.ts`. A route
declared outside the chain still serves traffic but disappears from the client's type,
and nothing else would notice — `apps/api/src/contract.test.ts` is the check that does.

Services raise `ServiceError` with a code, never a transport error. A transport error
thrown from a service is meaningless to a Server Action, to a Trigger.dev task, and to a
batch job — all of which call the same function with no HTTP in sight. The edge maps the
code to a status.

`.claude/skills/architecture-guard` is the authority on all of this.

## Skills

- `.agents/skills/` — 103 installed from `skills-lock.json`, not committed. Restore with
  `npx skills experimental_install`. That command cannot restore `well-known` sources, so
  re-add bun with `npx skills add bun.sh`.
- `.claude/skills/<name>/` — 39 authored here and committed.

## What was removed on extraction

The loyalty domain: stamps, points, rewards, promotions, campaigns, products, stores,
and the customer model. Also removed:

- **All migrations.** They encoded the removed schema. Generate a fresh initial one.
- **The old API package.** Its feature slices were written against a different
  transport's request context and the loyalty schema. The reusable ones were rewritten as
  services, and the transport was rebuilt on Hono.
- **The in-app notification service.** The channel abstraction and the tables are here;
  resolving who to notify is app-specific. ROADMAP §4.
