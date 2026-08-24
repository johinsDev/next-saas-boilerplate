---
name: api-filters
description: Three-layer feature pattern in `@saas/api` — router → service → repository — with composable filter classes. Use when adding a new API feature with list endpoints (filterable + paginated), refactoring an inline-Drizzle router into the feature-folder shape, or introducing a new filter on an existing list query.
---

> **Ported from `loyalty-app`, not yet rewritten for the app.** Two things differ:
>
> - **There is no tRPC here.** The typed API is **Hono RPC** (`hc<AppType>`, types only —
>   no runtime RPC, which is the whole reason we picked it over tRPC).
> - **Web and admin call `packages/services` directly**, in Server Components and Server
>   Actions. They never hop through the Hono API. Only mobile goes over HTTP.
>
> Where this file shows a tRPC procedure, read it as a service function. Some packages it
> names do not exist yet — it describes the target, not the current tree. The
> `architecture-guard` skill is the authority.

# API features — composable filters + Router/Service/Repository

Every feature in `@saas/api` that has list endpoints follows the same three-layer shape:

```
packages/api/src/features/<feature>/
├── schemas.ts          zod input + exported types
├── filters.ts          one Filters subclass per list query
├── repository.ts       Drizzle access (the only file that touches db)
├── service.ts          business logic on top of the repo
├── router.ts           tRPC procedures, thin
└── index.ts            barrel — re-exports the router only

packages/api/src/features/_shared/
└── filters.ts          abstract `Filters<TInput, TBuilder>` base
```

Reference implementation: `packages/api/src/features/whatsapp-outbox/`.

The filter pattern is lifted from Laravel's "Course Filters" idiom (https://github.com/codecourse/filtering-in-laravel) and adapted for TypeScript + Drizzle.

---

## Why three layers

Most CRUDish features end up with at least three concerns:

| Layer | Owns | Doesn't own |
| --- | --- | --- |
| **Router** | tRPC procedure shape, auth check (`publicProcedure` vs `protectedProcedure`), wiring the service | Drizzle queries, business rules |
| **Service** | Business rules (validations, opt-in checks, cross-repo composition, throwing `TRPCError`) | Drizzle calls, request shape |
| **Repository** | Drizzle calls (built via filters + pagination), nothing else | Auth, business policies, error shaping |

Keeping these separate means:
- The repository is trivial to test against a stub `db`.
- The service can grow domain rules without polluting the router.
- The router stays under 40 lines per procedure even as a feature matures.

Single-record reads (`get(id)`) and write commands often skip the filter mechanic but still split router → service → repository for consistency.

---

## The filter base class

`packages/api/src/features/_shared/filters.ts`:

```ts
export abstract class Filters<TInput extends object, TBuilder> {
  protected input: TInput;
  protected builder: TBuilder;

  constructor(builder: TBuilder, input: TInput) {
    this.builder = builder;
    this.input = input;
  }

  apply(): TBuilder {
    const values = this.input as Record<string, unknown>;
    for (const key of this.allowedFilters()) {
      const value = values[key];
      if (value === undefined || value === null || value === "") continue;
      const fn = (this as unknown as Record<string, (v: unknown) => void>)[key];
      if (typeof fn === "function") fn.call(this, value);
    }
    return this.builder;
  }

  protected abstract allowedFilters(): readonly string[];
}
```

Each subclass declares its filter keys via `allowedFilters()` AND implements a protected method per key. The base walks the list, skips empty values, and dispatches.

---

## Concrete filter set

`packages/api/src/features/whatsapp-outbox/filters.ts`:

```ts
class WhatsAppOutboxFilters<TBuilder extends WhereChainable> extends Filters<
  ListInput,
  TBuilder
> {
  protected allowedFilters(): readonly string[] {
    return ["to", "status", "search"] as const;
  }

  protected to(value: string): void {
    this.builder = this.builder.where(eq(whatsappOutbox.to, value));
  }

  protected status(value: WhatsAppOutboxStatus): void {
    this.builder = this.builder.where(eq(whatsappOutbox.status, value));
  }

  protected search(value: string): void {
    this.builder = this.builder.where(ilike(whatsappOutbox.content, `%${value}%`));
  }
}
```

Notes:
- Each method takes a value (already non-empty, already validated by zod upstream) and updates `this.builder`.
- Method names MUST match `allowedFilters()` keys exactly — that's how `apply()` finds them.
- Use Drizzle's `.$dynamic()` on the select chain in the repository so the chained `.where()` call returns the same chainable type.

---

## Repository

`packages/api/src/features/whatsapp-outbox/repository.ts`:

```ts
async list(input: ListInput): Promise<ListResult> {
  const offset = (input.page - 1) * input.pageSize;

  const baseRows = this.db.select().from(whatsappOutbox).$dynamic();
  const filteredRows = new WhatsAppOutboxFilters(baseRows, input).apply();
  const rows = await filteredRows
    .orderBy(desc(whatsappOutbox.sentAt))
    .limit(input.pageSize)
    .offset(offset);

  const baseCount = this.db
    .select({ value: sql<number>`count(*)::int` })
    .from(whatsappOutbox)
    .$dynamic();
  const filteredCount = new WhatsAppOutboxFilters(baseCount, input).apply();
  const total = (await filteredCount)[0]?.value ?? 0;

  return { rows, total };
}
```

Pagination contract: input has `page` (1-based) + `pageSize`, return is `{ rows, total }`. Same filter set powers both the rows query and the count.

---

## Service + router

```ts
// service.ts — thin pass-through today; business rules land here
export class WhatsAppOutboxService {
  constructor(private readonly repo: WhatsAppOutboxRepository) {}

  list(input: ListInput) {
    return this.repo.list(input);
  }

  async get(id: string) {
    const row = await this.repo.findById(id);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "..." });
    return row;
  }
}

// router.ts — one procedure per list/get; instantiate per-request
export const whatsappOutboxRouter = router({
  list: publicProcedure
    .input(listInputSchema)
    .query(({ ctx, input }) => {
      const service = new WhatsAppOutboxService(
        new WhatsAppOutboxRepository(ctx.db),
      );
      return service.list(input);
    }),
});
```

Service + Repository are instantiated **inside the procedure body** — no shared mutable state across requests.

---

## Adding a new feature

1. `mkdir packages/api/src/features/<name>/`
2. `schemas.ts` — define `listInputSchema`, optional `getInputSchema`, etc., with zod. Export `ListInput` etc.
3. `filters.ts` — subclass `Filters<ListInput, TBuilder>`, list filter keys, implement one protected method per key.
4. `repository.ts` — constructor takes `db`. `list()` builds the chain, applies filters twice (rows + count), returns `{ rows, total }`. Single-record helpers (`findById`) return `T | null`.
5. `service.ts` — constructor takes the repo. Methods mirror the router shape; throw `TRPCError` on not-found / forbidden.
6. `router.ts` — one tRPC procedure per service method. Instantiate `new Service(new Repository(ctx.db))` inside each body.
7. `index.ts` — `export { fooRouter } from "./router";` and types you want consumers to see.
8. Wire it into `packages/api/src/routers/_app.ts`.

## Adding a filter to an existing feature

1. Add the key + value type to the zod schema in `schemas.ts`.
2. Add the key to `allowedFilters()` in `filters.ts`.
3. Add a protected method with the same name that calls `this.builder = this.builder.where(...)`.
4. Surface the filter on the consumer (admin / web page, search params, etc.).
5. No repository or service change needed — the filter applies automatically on the next call.

---

## When this pattern is overkill

Skip the feature folder and stay flat in `routers/` when the feature is:

- A single RPC-style command (no list / no filter / no pagination).
- A health probe.
- A throw-away placeholder that hasn't grown logic yet.

The trigger to migrate is "I'm adding a list endpoint with at least one filter" — at that point, do the full split. Mixed feature folders + flat routers are fine; `routers/_app.ts` composes both happily.

---

## Conventions baked into the pattern

- **Router is `publicProcedure` or `protectedProcedure` — never both at once for a single feature.** If a feature has both public and private endpoints, split into two services that share the repo.
- **`ctx.db` is the only way Drizzle reaches a feature.** Don't import `db` from `@saas/db` directly inside a feature — always use `ctx.db` so tests can pass a stub.
- **Zod schemas live in `schemas.ts` and nowhere else.** Consumers (apps/web, apps/admin) re-derive types via `inferRouterInputs<AppRouter>` rather than importing schemas directly.
- **Empty string === no filter.** The base `apply()` treats `""` as missing on purpose; URL state from `nuqs` defaults to `""`, so the gate works without extra parsing.
- **Pagination is always 1-based.** `page=1, pageSize=25` is the convention. `total` is returned alongside `rows`.

---

## References

- Pattern source: https://github.com/codecourse/filtering-in-laravel
- Filter base: `packages/api/src/features/_shared/filters.ts`
- Reference feature: `packages/api/src/features/whatsapp-outbox/**`
- Consumer using URL state + this router: `apps/web/app/[locale]/whatsapp-outbox/page.tsx`
