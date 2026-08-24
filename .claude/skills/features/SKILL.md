---
name: features
description: How a feature is laid out in the app — a vertical slice in packages/services (schemas, repository, service) and a matching slice in the app (queries, actions, components), with Next.js 16 conventions for Suspense, caching and revalidation. Use when starting a new feature, deciding which file a piece of code belongs in, naming a file, or reviewing a pull request for structural drift.
---

# Feature structure

A feature is a **vertical slice**. Everything it needs sits together, and it is deleted by
deleting a folder. Read `architecture-guard` first — it decides which layer may call which.

## Shape

```
packages/services/src/features/cases/
  schemas.ts        zod schemas + inferred types. The contract, shared by every caller.
  repository.ts     drizzle only. Rows in, rows out. No rules.
  service.ts        the business rules. The unit worth testing.
  service.test.ts   next to what it tests.
  index.ts          the public surface. Anything not exported here is internal.

apps/admin/src/features/cases/
  cases-queries.ts    import "server-only" — reads, called from Server Components
  cases-actions.ts    "use server" — writes, called from forms and event handlers
  components/         the feature's own UI
  index.ts
```

The app-side slice mirrors the service-side slice by name. `cases` on one side is `cases`
on the other.

## Naming

- **Folders**: plural domain nouns — `cases`, `boards`, `duels`, `suspects`.
- **App-side files carry the domain prefix**: `cases-queries.ts`, not `queries.ts`. They
  end up open in tabs next to twenty other `queries.ts` otherwise.
- **Service functions read as verbs**: `listCases`, `publishCase`, `measureCaseDifficulty`.
- **Repository functions say they touch rows**: `selectCasesByStatus`, `insertCase`.

## Next.js 16 conventions

`cacheComponents: true` is on, which implies PPR.

- **Pages are synchronous.** Do not `await` at the top level of a page. Take the promise
  (`params.then(...)`) and hand it down.
- **The page owns `<Suspense>`; the feature owns the skeleton**, and the skeleton lives in
  the same file as the component it stands in for. A skeleton that drifts from its
  component is a skeleton nobody updates.
- **Reads** go in `<domain>-queries.ts` with `import "server-only"`.
- **Writes** go in `<domain>-actions.ts` with `"use server"`, and call `updateTag()`.
- **`revalidateTag(tag, "max")` belongs in route handlers only**, never in a Server Action.
- **Client `queryFn` hits `/api/*` route handlers.** Never a Server Function, never the
  external Hono API.

## Where tests go

Next to the code, named after it: `service.ts` → `service.test.ts`. The rule from
`test-driven-development` applies — the test is written first and watched failing.

The interesting tests are in the **service** layer and in `packages/game-core`.
Repositories are thin enough that testing them mostly tests drizzle; route handlers are
thin enough that testing them mostly tests Hono.

## Adding a feature

1. `schemas.ts` — write the contract first. It is what the other files agree on.
2. `repository.ts` — the narrowest row access that satisfies it.
3. `service.ts` — the rules, TDD, red first.
4. `index.ts` — export only what callers need.
5. App slice — `<domain>-queries.ts` / `<domain>-actions.ts`, then components.
6. If mobile needs it — a route in `apps/api`, thin, calling the same service.

Step 6 is last and often never happens. Do not build the API route "while you are in
there": an unused endpoint is surface area with an auth check nobody reviews.
