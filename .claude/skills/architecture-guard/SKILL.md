---
name: architecture-guard
description: The data-access rule for the app — web and admin call packages/services directly from Server Components and Server Actions; only mobile crosses the network, via Hono RPC types. Use when adding a query or mutation, wiring a new feature to the database, deciding where a piece of logic lives, reviewing an import that crosses a package boundary, or when tempted to fetch from the Hono API inside a Next.js server file.
---

# Architecture guard — where data access lives

This is the authority on data access in the app. Where a ported `loyalty-app` skill
disagrees with this file, this file wins.

## The one rule

```
                             ┌───────────────────────────┐
   apps/web    (RSC/Action) ─┤                           │
   apps/admin  (RSC/Action) ─┤  packages/services        ├─► packages/db ─► Turso
                             │  import "server-only"     │
   apps/api    (Hono/Workers)┤                           │
                             └───────────────────────────┘
        ▲
        │  hc<AppType> — TYPES ONLY, ~0 bytes of runtime
        │
   apps/mobile (Expo)
```

**Web and admin never call the Hono API.** They import services and run them in the same
process.

### Why

`apps/web` and `apps/admin` run on Vercel. `apps/api` runs on Cloudflare Workers. A Server
Component that fetched its own API would leave Vercel, cross the public internet to
Cloudflare, and come back — for data it could have read in the same process. That is a
round trip of pure latency, plus a second serialisation, plus a second auth check, plus a
new failure mode, and it buys nothing: the Next server is already trusted, already has the
session, and already has the database binding.

The API exists for **clients that are not our server**. That is mobile, and one day third
parties. It is not a service bus for our own render.

### Why Hono RPC and not Hono RPC

`hc<AppType>` is a **type-only** import. The mobile bundle gets the contract at compile
time and ships nothing at runtime. Hono RPC ships a client. On a React Native bundle that
difference is the reason for the choice — do not "simplify" it back to Hono RPC.

## The layers

| Layer | Lives in | May import | Must not |
|---|---|---|---|
| **repository** | `packages/services/src/features/<domain>/repository.ts` | `packages/db`, drizzle | Contain business rules, know about HTTP, know about React |
| **service** | `packages/services/src/features/<domain>/service.ts` | its repository, other services, `packages/*` infra | Import from `apps/**`, touch `headers()`/`cookies()`, know about HTTP |
| **route/procedure** | `apps/api/src/routes/<domain>.ts` | services | Contain business rules, touch drizzle |
| **queries** | `apps/<app>/src/features/<domain>/<domain>-queries.ts` | services | Be imported by a Client Component |
| **actions** | `apps/<app>/src/features/<domain>/<domain>-actions.ts` | services | Be called by `queryFn` |

`packages/services` deliberately does **not** carry `import "server-only"`. That guard is a
Next.js construct and it throws anywhere React is not — including inside the Worker and in a
plain test run. It belongs one layer up, in each app's `<domain>-queries.ts`, which is where
a client/server boundary actually exists. Put it there and "a client component imported a
service" is a build error instead of a runtime data leak; put it in the package and the API
stops booting.

## Callers, in detail

**Server Components and Server Actions (web, admin)** — call the service directly.

```ts
// apps/admin/src/features/cases/cases-queries.ts
import "server-only";
import { listCases } from "@saas/services/cases";

export async function getCases(status: CaseStatus) {
  return listCases({ status });
}
```

**Client Components (web, admin)** — `queryFn` hits a Next route handler under `/api/*`,
which is a thin wrapper over the same service.

- Never call a Server Function from `queryFn`. Server Functions are sequential and are not
  a data-fetching transport.
- Never call the external Hono API from the browser of our own web app. It is a different
  origin with a different auth shape.

**Mobile (Expo)** — the only caller that crosses the network.

```ts
import { hc } from "hono/client";
import type { AppType } from "@saas/api";   // type-only: 0 bytes shipped

const api = hc<AppType>(process.env.EXPO_PUBLIC_API_URL!);
const res = await api.organizations[":id"].settings.$get({ param: { id } });
```

`AppType` is inferred from the **route chain** in `apps/api/src/index.ts`. A route declared
outside that chain still serves traffic but vanishes from the client's type, and nothing
else would notice — `apps/api/src/contract.test.ts` is the check that does.

**The Hono API itself** — a thin transport shell. It parses, authenticates, calls a
service, and serialises. Business rules that live in a route handler are unreachable from
web and admin, which is how two implementations of the same rule start.

## One database client per request

Workers bind I/O to the request that opened it, so `createDb(config)` takes its
configuration rather than reading `process.env` at module scope. A module-level client
works in development and then fails in production the moment a second request reuses it.

## Red flags

| You are writing | Stop, because |
|---|---|
| `fetch(process.env.API_URL)` inside `apps/web` or `apps/admin` server code | That is the Vercel→Cloudflare hop. Import the service. |
| `import { db }` in an `app/**` file | Data access belongs in a repository, behind a service. |
| A drizzle query inside `apps/api/src/routes/**` | Web and admin cannot reach it. Move it to a repository. |
| `import { hc }` without `import type` for the contract | You just shipped an RPC client to the mobile bundle. |
| A Client Component importing anything from `packages/services` | `server-only` will fail the build. Go through a route handler. |
| `queryFn: () => someServerAction()` | Server Functions are not a fetch transport. |

## When the rule genuinely does not fit

If web needs something only the Worker can do (a Durable Object, a binding that exists
only on Cloudflare), that is a real reason to cross the boundary. Say so in the code, in a
comment, at the call site. The rule is about the default, not about pretending the
exception never exists.
