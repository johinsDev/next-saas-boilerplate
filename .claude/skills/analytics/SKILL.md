---
name: analytics
description: Product analytics for the next-saas-boilerplate monorepo — `@saas/analytics` (memory-style abstraction) backed by PostHog (browser + node), the React Context exposing `track`/`page`/`identify`/`reset`, and the per-request Hono RPC `ctx.analytics` binding. Use when adding a new tracked event, wiring identify after login, choosing the right `distinctId` for an anonymous endpoint, debugging "events not showing in PostHog", or adding a new analytics provider.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# analytics — `@saas/analytics` + PostHog (server + client)

Provider-agnostic product analytics. Same shape as `@saas/cache`/`@saas/sms`/`@saas/rate-limit` (strategy + factory + env swap + faker + UTs), but dual-entry (mirror of `@saas/auth`): server (`posthog-node`) for Hono RPC server, client (`posthog-js`) for the React Context. Two providers ship: `null` (noop) and `posthog`.

```
packages/analytics/
├── src/
│   ├── index.ts                 shared types + errors (no runtime)
│   ├── server.ts                AnalyticsManager + forRequest() + FakeAnalytics
│   ├── client.ts                createAnalytics() — browser, lazy posthog-js
│   ├── react.tsx                AnalyticsProvider + useAnalytics() (`"use client"`)
│   ├── types.ts                 Analytics, AnalyticsBinding, AnalyticsEvent, BaseProperties
│   ├── fake-analytics.ts        records + assertions
│   ├── errors.ts                AnalyticsError / ProviderError / MissingDependencyError
│   └── providers/{null-server,posthog-server,_lazy}.ts
packages/api/src/
├── lib/analytics.ts             the analytics binding on the Hono context
└── analytics.ts                 resolveDistinctId(ctx) + baseProperties(ctx, app)
apps/{web,admin}/src/lib/analytics.ts   server bootstrap (manager singleton, bound on ctx)
apps/{web,admin}/app/[locale]/providers.tsx  mounts <AnalyticsProvider> in the client tree
```

---

## API surface

All four methods accept an optional `properties` object that's merged on top of the base properties (`app`, `environment`, `locale`, `distinctId`).

| Method | Where | Notes |
| --- | --- | --- |
| `track(event, props?)` (client) / `capture(event, props?)` (server) | React via `useAnalytics()`, Hono RPC via `ctx.analytics?.capture(...)` | Send a custom event. |
| `page(props?)` | both | Emits `$pageview`. The React provider auto-fires it on every App Router navigation; you only call it manually for non-route "screens". |
| `identify(distinctId, props?)` (client) / `identify(props)` (server, distinctId already baked) | both | **Auto-called** by `AnalyticsProvider` when the Better Auth session appears. Call manually if you want to identify before login (rare). |
| `reset()` (client only) | React | **Auto-called** when the session flips to null on sign-out. |

The browser surface is exposed through `useAnalytics()`. **Outside `AnalyticsProvider`** the hook returns a safe noop — never throws.

```tsx
"use client";
import { useAnalytics } from "@saas/analytics/react";

export function ClaimRewardButton({ rewardId }: { rewardId: string }) {
  const analytics = useAnalytics();
  return (
    <Button onClick={() => analytics.track("reward.claimed", { rewardId })}>
      Claim
    </Button>
  );
}
```

```ts
// inside a a POST route
.mutation(({ ctx, input }) => {
  // ...do the work...
  ctx.analytics?.capture("stamp.earned", { cardId: input.cardId });
});
```

---

## Basic properties (auto-attached)

The server `forRequest()` and the React `AnalyticsProvider` register these so every event carries them — filter/group by them in PostHog:

| Property | Source |
| --- | --- |
| `distinctId` | `user:<id>` when signed in, else `anon:<client-ip>` |
| `app` | `"web"` or `"admin"` |
| `environment` | server: `VERCEL_ENV` (`production`/`preview`/`development`); client: `NEXT_PUBLIC_VERCEL_ENV` ?? `NODE_ENV` |
| `locale` | server: `x-locale` header (set by middleware); client: `useLocale()` |
| `$current_url`, `$browser`, `$device`, `$referrer`, … | PostHog browser auto-capture |
| `$pathname`, `$search` | added by the React provider on every navigation |

To add a property to a single event, pass it in the second arg. To add a global property, append it to `baseProperties(ctx, …)` (server) or the `AnalyticsProvider` props (client).

---

## Provider cascade + env

Server bootstrap (`apps/{web,admin}/src/lib/analytics.ts`) picks the strategy by env. Client mount (`providers.tsx`) picks by **presence of `NEXT_PUBLIC_POSTHOG_KEY`** (so a single Vercel env variable controls both sides).

| Env | Server default | Client default |
| --- | --- | --- |
| local dev | `null` | `null` (no key set) |
| preview | `null` | `null` |
| production | `posthog` | `posthog` (key set) |

Override `ANALYTICS_PROVIDER=null|posthog` to flip the **server**. To test on a single preview, pin `NEXT_PUBLIC_POSTHOG_KEY` (and `ANALYTICS_PROVIDER=posthog`) branch-scoped on Vercel — events arrive tagged `environment=preview`.

**Infisical** (`/shared`): `ANALYTICS_PROVIDER=null` in **dev** and **staging** (the preview base). `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` live in **prod** (added with Fase 4 alongside the other prod values). PostHog project keys (`phc_…`) are **public + embeddable** — no Sensitive flag.

---

## Adding a new tracked event

1. **Add the event name** to the `AnalyticsEvent` union in `packages/analytics/src/types.ts` (the union accepts any string at runtime; declaring it gates typo drift at review).
2. **Fire it**:
   - From a Hono route: `ctx.analytics?.capture("my.event", { …props })`.
   - From a React component: `useAnalytics().track("my.event", { …props })`.
3. **Test it** with the `FakeAnalytics` (below).
4. **Document** the props you decided on in a comment near the declaration so the next person doesn't invent a parallel shape.

---

## Adding a new provider (5 steps)

Mirror the `cache` skill's runbook:

1. **Implement** `AnalyticsStrategy` in `packages/analytics/src/providers/<name>-server.ts` (for the server path) and/or a `createAnalytics`-shape factory in the client path. Lazy-load the SDK via `dynamicImport()` from `providers/_lazy.ts` so apps that don't pick it don't bundle it.
2. **Extend** the `ProviderConfig` union in `types.ts` and the strategy/client constructors.
3. **Wire** the new branch into `createStrategy()` in `server.ts` (and the client `createAnalytics()` if it ships a browser variant).
4. **Add a unit test** under `__tests__/providers/<name>.test.ts` covering the happy path + the `MissingDependencyError` when the SDK isn't installed.
5. **Update bootstrap + env**: extend the `ANALYTICS_PROVIDER` enum in `apps/{web,admin}/src/env.ts`, add the conditional config block in `lib/analytics.ts`, bump `peerDependencies`, append the SDK to `knip.json` under `packages/analytics.ignoreDependencies`.

---

## Testing with `FakeAnalytics`

The manager fails open when `ctx.analytics` is unbound (CLI / tests), so router tests aren't noisy by default. To assert events, install a `FakeAnalytics` on the manager:

```ts
import { FakeAnalytics } from "@saas/analytics/server";

const fake = analytics.fake(new FakeAnalytics()); // optional arg
// …call the unit under test…
fake.assertCaptured("stamp.earned", (e) => e.properties.cardId === "c_1");
fake.assertIdentified("user:abc");
analytics.restore();
```

`FakeAnalytics` records every `capture` / `identify`, exposes the `.captured` and `.identified` arrays, and adds assertion helpers (`assertCaptured`, `assertNotCaptured`, `assertIdentified`).

---

## Common pitfalls

- **"Events don't show up in PostHog."** Check the cascade. In dev + preview the default is `null` (intentional). For a one-off preview test, pin `ANALYTICS_PROVIDER=posthog` + `NEXT_PUBLIC_POSTHOG_KEY` branch-scoped on Vercel. Then redeploy — `NEXT_PUBLIC_*` is build-time.
- **Server events with a wrong distinctId.** `resolveDistinctId(ctx)` returns `user:<id>` only when the session is non-null. Anonymous mutations fall through to `anon:<ip>` (Vercel's `x-forwarded-for` first hop). If your endpoint should always be signed in, gate it with `an authenticated route` first.
- **`identify` is called twice on hard reloads.** The React provider remembers the last identified user via `useRef`; it skips a re-call if the id hasn't changed. If you see double-identifies, you probably wrapped two `<AnalyticsProvider>`s.
- **PII in events.** Don't pass email/phone/etc in event properties. Use `identify(distinctId, { email })` once at login (the provider does this automatically); keep events purely about the action.
- **SSR hydration mismatches with `useAnalytics`.** The hook returns the same surface server-side (noop) and client-side, so SSR is safe — but call it from a `"use client"` component, not a server one.
- **`flush()` / `shutdown()` on serverless.** posthog-node's default buffer is fine here because the server strategy sets `flushAt: 1`. If you batch events explicitly, call `await analytics.flush()` before returning from a long-running handler.

---

## Future / out of scope

- **Feature flags / A-B experiments.** PostHog supports them on the same project (`posthog.isFeatureEnabled` / `getFeatureFlag`). A future PR can add a thin layer to the same `AnalyticsManager` + `AnalyticsProvider`.
- **Replays + heatmaps.** posthog-js auto-captures these when enabled; configure via the `AnalyticsProvider` `host` / init options when the team wants them on.
- **Server-side replay-friendly properties.** None of `$current_url`/`$referrer` make sense for server events; we currently leave PostHog to fill in browser-side ones.

---

## References

- `packages/analytics/src/*` — abstraction, dual entry.
- `packages/api/src/{the API,analytics}.ts` — Context binding + helpers.
- `apps/{web,admin}/src/lib/analytics.ts` — server bootstrap.
- `apps/{web,admin}/app/[locale]/providers.tsx` — React mount.
- `.claude/skills/cache/SKILL.md` — the sibling provider-agnostic abstraction.
- PostHog Node — https://posthog.com/docs/libraries/node
- PostHog JS — https://posthog.com/docs/libraries/js
