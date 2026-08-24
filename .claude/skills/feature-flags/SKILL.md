---
name: feature-flags
description: Feature flags + A-B testing for the next-saas-boilerplate monorepo — `@saas/feature-flags` backed by PostHog (browser + node), the React Context exposing `useIsFeatureEnabled`/`useFeatureFlag`, and the per-request Hono RPC `ctx.flags` binding. Use when adding a new flag, gating UI by a flag, running an A-B experiment, choosing the right `distinctId`, debugging "flag returns default in preview", or adding a new flags provider.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# feature-flags — `@saas/feature-flags` + PostHog (server + client)

Sibling abstraction to `@saas/analytics`. Same pattern, same project (one PostHog org covers both products), different cascade. Two providers: `null` (returns the supplied default — no network) and `posthog` (lazy `posthog-node` server side, lazy `posthog-js` client side).

Covers three use cases that PostHog feature flags handle:
- **Kill switch** — boolean flag, off by default; flip it on to enable a feature without a redeploy.
- **Gradual rollout** — percentage rollout, gated by `distinctId`.
- **A-B experiment** — multi-variant flag returning a variant name (`"control"` / `"treatment"`); PostHog auto-fires `$feature_flag_called` so variant exposure is captured in the analytics product.

```
packages/feature-flags/
├── src/
│   ├── index.ts                 shared types + errors (no runtime)
│   ├── server.ts                FlagsManager + forRequest() + FakeFlags
│   ├── client.ts                createFlags() — browser, lazy posthog-js
│   ├── react.tsx                FlagsProvider + use* hooks (`"use client"`)
│   ├── types.ts                 Flags, FlagsBinding, FlagKey, FlagValue, ProviderConfig
│   ├── fake-flags.ts            tunable + assertions
│   ├── errors.ts                FeatureFlagsError / ProviderError / MissingDependencyError
│   └── providers/{null-server,posthog-server,_lazy}.ts
apps/api/src/lib/                Context.flags? FlagsBinding
apps/{web,admin}/src/lib/feature-flags.ts   server bootstrap (manager singleton, bound on ctx) + local resolveDistinctId helper
apps/{web,admin}/app/[locale]/providers.tsx mounts <FlagsProvider> inside <QueryProvider>
```

---

## API surface

| Use case | Server (router) | Client (React) |
| --- | --- | --- |
| Kill switch | `await ctx.flags?.isEnabled("new-stamp-flow", false)` | `useIsFeatureEnabled("new-stamp-flow")` |
| Rollout (boolean, % based) | same | same |
| A-B variant | `await ctx.flags?.getValue("checkout-variant", "control")` | `useFeatureFlag("checkout-variant", "control")` |
| Read all flags | `await ctx.flags?.getAllFlags()` | — (debug only) |

All methods take an optional `defaultValue` — the value returned when the flag is missing, the network errors, or the provider is `null`.

```tsx
"use client";
import { useIsFeatureEnabled, useFlagsLoaded } from "@saas/feature-flags/react";

export function StampScreen() {
  const isNew = useIsFeatureEnabled("new-stamp-flow");
  const loaded = useFlagsLoaded();
  if (!loaded) return <Skeleton />; // avoid flashing the default
  return isNew ? <NewStampFlow /> : <ClassicStampFlow />;
}
```

```ts
// in a a POST route
.mutation(async ({ ctx, input }) => {
  if (await ctx.flags?.isEnabled("new-stamp-flow")) {
    return newAdd(ctx, input);
  }
  return classicAdd(ctx, input);
});
```

---

## distinctId — what PostHog evaluates against

Same identity model as `@saas/analytics`:

- **Server**: `resolveDistinctId(ctx)` returns `user:<id>` if signed in, else `anon:<client-ip>` (first hop of `x-forwarded-for`, fallback `x-real-ip`). The route handler builds the binding with that id, so every flag check in that request is keyed the same.
- **Client**: posthog-js holds its own distinctId. Once `@saas/analytics`'s `AnalyticsProvider` calls `posthog.identify(userId, …)` after sign-in, flag evaluations re-bucket for that user automatically (PostHog re-fetches flags on identify). If you mount `FlagsProvider` without `AnalyticsProvider`, anonymous flag evaluation uses posthog-js's internal anonymous id — still consistent across reloads.

Result: a user gated into a rollout sees the same value on both sides.

---

## Provider cascade + env

Different from analytics: **flags evaluate against real PostHog in previews** (so you can verify the gating per-PR), `null` only in local dev.

| Env | Server default | Client default |
| --- | --- | --- |
| local dev | `null` | `null` (no key set) |
| preview | `posthog` | `posthog` (key set via Infisical/Vercel) |
| production | `posthog` | `posthog` |

Override `FEATURE_FLAGS_PROVIDER=null|posthog` per-env. To temporarily turn flags off on a preview, set `FEATURE_FLAGS_PROVIDER=null` branch-scoped on Vercel.

**Infisical** (`/shared`): `FEATURE_FLAGS_PROVIDER=null` in `dev`, `=posthog` in `staging` (preview base). `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` land with Fase 4 (or per-preview override now). Project keys (`phc_…`) are public + embeddable — no Sensitive flag.

---

## Adding a new flag

1. **Create the flag in PostHog** (Project → Feature Flags → New). Pick: boolean (kill switch / rollout) or multi-variant (A-B).
2. **Add the key** to the `FlagKey` union in `packages/feature-flags/src/types.ts` (`"my-flag"`). Runtime accepts any string; the union catches typos at review.
3. **Gate** the code:
   ```ts
   // server
   if (await ctx.flags?.isEnabled("my-flag", /* defaultValue */ false)) { … }
   // client
   const enabled = useIsFeatureEnabled("my-flag");
   ```
4. **Pick a sensible default** — what should happen when PostHog is unreachable or the flag was deleted? Usually the **safe path** (kill switch defaulting to `false` so a new feature stays gated; an A-B defaulting to `"control"` so the experiment doesn't accidentally treat everyone).
5. **Test** with `FakeFlags` (below).
6. **Roll out** — start at 1%, watch the metrics in PostHog, ramp up.

---

## Adding a new provider (5 steps)

Mirror the `cache` / `rate-limit` / `analytics` skills:

1. **Implement** `FlagsStrategy` in `packages/feature-flags/src/providers/<name>-server.ts` (server) and/or a `createFlags` branch in `client.ts`. Lazy-load the SDK via `dynamicImport()` from `providers/_lazy.ts`.
2. **Extend** the `ProviderConfig` union in `types.ts`.
3. **Wire** the new branch into `createStrategy()` in `server.ts` (and `createFlags` if it ships a client variant).
4. **Add a unit test** under `__tests__/providers/<name>.test.ts` — covers the happy path + `MissingDependencyError` when the SDK isn't installed.
5. **Update bootstrap + env**: extend `FEATURE_FLAGS_PROVIDER` enum in `apps/{web,admin}/src/env.ts`, add the conditional config block in `lib/feature-flags.ts`, bump `peerDependencies`, append the SDK to `knip.json` under `packages/feature-flags.ignoreDependencies`.

---

## Testing with `FakeFlags`

```ts
import { FakeFlags } from "@saas/feature-flags/server";

// in a router test
const fake = flags.fake(new FakeFlags()
  .set("new-stamp-flow", true)
  .set("checkout-variant", "treatment"));

// …call the unit under test…

fake.assertChecked("new-stamp-flow");
flags.restore();
```

`FakeFlags` records every `.checked` (with the distinctId), `set(key, value)` pins a value (boolean or string for variants), and unset keys return `undefined` so the caller's default takes over — same semantics as a missing flag in PostHog.

---

## Common pitfalls

- **"My flag returns the default in preview."** Check the cascade: preview default is `posthog`, BUT it needs `NEXT_PUBLIC_POSTHOG_KEY` set in Vercel for that env. If the key isn't synced yet, the bootstrap falls back to `null`. Pin the key branch-scoped to test in a single PR; otherwise wait for Fase 4.
- **"It works on the client but the server gates wrong (or vice-versa)."** distinctIds must agree. The server uses `resolveDistinctId(ctx)` (user:id / anon:ip); the client uses posthog-js's distinctId — which is anonymous until `identify()`. Make sure `@saas/analytics`'s `AnalyticsProvider` is mounted so identify runs after login.
- **Initial flash of the default value.** The client returns the default while `posthog.onFeatureFlags` hasn't fired. Use `useFlagsLoaded()` to delay the render or hide the gated UI until flags resolve. PostHog's `bootstrap` option (passing server-evaluated flags into the client init) would remove this — noted as future.
- **Per-request HTTP cost on the server.** Each `ctx.flags.isEnabled(...)` is a posthog-node API call. Acceptable for pilot traffic; for higher load, switch to **local evaluation** (posthog-node `getAllFlags` with cached flag definitions via a `personalApiKey`). Noted as future.
- **A-B exposure tracking.** PostHog auto-fires `$feature_flag_called` whenever a flag is read on a client with analytics initialised. The variant property gets attached to that user's events automatically. No extra wiring needed; this only works when `@saas/analytics`'s `AnalyticsProvider` is mounted alongside (recommended).
- **Flag mismatch across server + client.** If a server-rendered page renders one branch and then the client hydrates with a different value (because flags hadn't loaded yet on the client), React will complain. Pattern: gate inside a `useEffect` + `useState`, or render the default UI server-side and let the client swap in after flags load.

---

## Future / out of scope

- **Local evaluation** — `personalApiKey` + `posthog-node`'s cached flag definitions removes the per-request HTTP hop on the server. Worth doing when traffic justifies.
- **SSR `bootstrap`** — passing server-evaluated flag state into the client so first paint matches the eventual flag values (no flicker).
- **Flag deletion guardrails** — a linter that fails when a `FlagKey` literal is used in code but missing from PostHog (or vice-versa).

---

## References

- `packages/feature-flags/src/*` — abstraction, dual entry.
- `apps/api/src/lib/` — `Context.flags?` binding type.
- `apps/{web,admin}/src/lib/feature-flags.ts` — server bootstrap.
- `apps/{web,admin}/app/[locale]/providers.tsx` — React mount.
- `.claude/skills/analytics/SKILL.md` — sibling product analytics abstraction (shares the PostHog project).
- PostHog Feature Flags — https://posthog.com/docs/feature-flags
