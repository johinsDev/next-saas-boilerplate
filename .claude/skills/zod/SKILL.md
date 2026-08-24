---
name: zod
description: How we validate in the next-saas-boilerplate monorepo — Zod is the single source of truth for shapes at every boundary (API/the validated inputs, env, forms, search params, realtime/job payloads). Use when adding or refactoring a schema, deciding parse vs safeParse, sharing a schema between a form and a route handler, modeling unions/refinements/transforms, validating env, or wiring `zodResolver` into a form. Pairs with the `react-hook-form` and `api-filters` skills.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# zod

Zod (`^3.24`) is the **one** way we describe and validate data shapes. The rule of thumb: **define the schema once, `z.infer` the type, reuse the schema at every boundary it crosses.** Never hand-write a TS interface next to a Zod schema — infer it.

We validate at the edges (untrusted input) and trust types inside. Edges in this repo: route handler inputs, `env.ts`, form submits, URL/search params, and Trigger.dev/realtime payloads that cross a wire.

## Where Zod already lives

| What | Where |
| --- | --- |
| the validated input schemas (one per feature) | `packages/api/src/features/<name>/schemas.ts` |
| Env validation (server + client) | `apps/{web,admin}/src/env.ts`, `packages/jobs/env.ts` (`@t3-oss/env-*` over Zod) |
| Message/content schemas in providers | `packages/{sms,push,email,whatsapp}/src/schemas.ts` |
| Form schemas (with `zodResolver`) | colocated with the form — see the `react-hook-form` skill |

## The core rules

**1. Schema first, type inferred.** Never duplicate.
```ts
export const sendInputSchema = z.object({
  customerIds: z.array(z.string().min(1)).min(1).max(500),
  notificationKey: z.enum(["new-user", "promo"]),
});
export type SendInput = z.infer<typeof sendInputSchema>;
```

**2. `safeParse` at boundaries you don't control; `parse` only when a throw is the right failure.**
- Hono RPC does the parse for you (pass the schema to `.input()`) — never re-validate inside the resolver.
- For our own boundary checks (a webhook body, a job payload), prefer `safeParse` and handle `!result.success` explicitly. Reserve `.parse()` for "this is a programmer error if it fails".

**3. One schema, both sides.** A form and the route handler that receives it should share the same schema (export it from the feature's `schemas.ts`, import it in the form for `zodResolver`). That's how the client and server agree on validation with zero drift.

**4. `z.coerce` for string-origin inputs** (URL/search params via `nuqs`, env numbers, form number fields):
```ts
const pageSchema = z.coerce.number().int().min(1).default(1); // "2" -> 2
```

## Patterns we use

**Discriminated unions** for provider configs / variant payloads (mirrors `ProviderConfig` in the messaging packages):
```ts
const event = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stamp.earned"), amount: z.number().int() }),
  z.object({ type: z.literal("reward.ready"), rewardId: z.string() }),
]);
```

**`refine` / `superRefine`** for cross-field rules; attach the error to the right path:
```ts
schema.superRefine((val, ctx) => {
  if (val.start > val.end)
    ctx.addIssue({ code: "custom", path: ["end"], message: "end must be after start" });
});
```

**`transform`** to normalize at the edge (trim, lowercase, parse JSON) so the inside only sees clean data. Keep transforms at the boundary, not sprinkled in business logic.

**Enums** via `z.enum([...] as const)` — reuse `.options` to render selects (the notifications feature does this for channels). Don't restate the union elsewhere.

## Footguns

- **Don't recreate schemas inside a React render** — define at module scope (or `useMemo`). A new schema each render defeats memoization and `zodResolver` identity.
- **`.parse()` throws** — an unhandled throw at a boundary is a 500. Use `safeParse` unless you want the throw.
- **Optional vs nullable vs default**: `.optional()` (`undefined`), `.nullable()` (`null`), `.default(x)` (fills `undefined`). DB columns that are nullable → `.nullable()`; query params → `.optional()` or `.default()`.
- **`z.string().uuid()` is wrong for Better Auth ids** — they're not UUIDs. Use `z.string().min(1)` for `user.id`/`customer.id`; reserve `.uuid()` for our `crypto.randomUUID()` rows (see the `notifications.send` history).
- **Don't validate twice.** If Hono RPC validated the input, the service/repository trusts it.

## Common tasks

| Goal | Do |
| --- | --- |
| New API input | add to `features/<name>/schemas.ts`, infer the type, pass to `.input()` |
| Share validation with a form | export the schema, use `zodResolver(schema)` (see `react-hook-form` skill) |
| Validate a new env var | add to `env.ts` server/client block (Zod via `@t3-oss/env-*`) |
| Parse search/query params | `z.coerce.*` + `.default()` |
| Variant payload | `z.discriminatedUnion("type", [...])` |
| Cross-field rule | `.superRefine` with `ctx.addIssue({ path })` |

## Why one schema everywhere

Drift between a TS type, a form's validation, and a server's validation is where bugs live. Zod collapses all three into one declaration: the schema validates at runtime, `z.infer` gives the compile-time type, and the same object travels from the form to the the validated input. Change the shape once, everything follows.
