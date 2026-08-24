---
name: sentry
description: Error tracking for the next-saas-boilerplate monorepo via Sentry (@sentry/nextjs) in apps/web + apps/admin — client + server + edge exception capture, source-map symbolication, release tracking. Better Stack stays the system of record for logs/perf/uptime; Sentry owns exceptions. Use when adding/debugging error capture, wiring the tRPC capture hook, creating a Sentry project, tuning sampling, or onboarding a teammate to "where do crashes go".
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

# Sentry — error tracking

Sentry captures **exceptions** (frontend + backend) for `apps/web` and
`apps/admin`: grouped, source-mapped, tagged by release + environment. It runs
**alongside** Better Stack — not instead of it. Division of labour:

- **Better Stack** (`@saas/log`) — structured operational logs, tRPC perf,
  uptime, dashboards, alerts. The system of record.
- **Sentry** — unhandled exceptions, client crashes, grouped issues with
  readable stacks. The thing Better Stack Logs can't do (no client capture, no
  symbolication).

**Do not double-route.** `log.error(...)` keeps going to Better Stack; Sentry's
SDK owns exceptions via its own handlers. The one explicit bridge is the tRPC
`captureError` hook (below), because tRPC swallows thrown errors so they never
reach Sentry's automatic instrumentation.

## Gating: enabled only when the DSN is set

Mirrors the PostHog / Better Stack pattern. `NEXT_PUBLIC_SENTRY_DSN` unset →
every `Sentry.init` is skipped and the SDK is inert. So **local dev has Sentry
off** by default; preview + prod opt in via Infisical. A dev can set the DSN
locally to test.

## File layout (same in both apps)

| File | Role |
| --- | --- |
| `instrumentation.ts` | `register()` inits the **server + edge** SDK (gated on DSN). Exports `onRequestError = Sentry.captureRequestError` — catches nested RSC / route-handler errors. |
| `instrumentation-client.ts` | Inits the **browser** SDK (Next 15.3+/16 replaces `sentry.client.config.ts`). Exports `onRouterTransitionStart` for navigation instrumentation. |
| `app/global-error.tsx` | Root error boundary. React swallows render errors into boundaries (they never hit `window.onerror`), so it calls `Sentry.captureException` by hand. Renders its own `<html>`; copy is intentionally minimal and **not** localized (no next-intl at this level). |
| `next.config.ts` | Wrapped **outermost** by `withSentryConfig(...)` (over Serwist + next-intl). Uploads source maps at build time; sets the `/monitoring` tunnel route. |
| `src/lib/sentry.ts` | `captureError` — the app's binding for the tRPC hook (see below). |

Config is **errors-only** to start: `tracesSampleRate: 0`,
`replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 0`. Perf lives in
Better Stack; turn tracing/replay on later if we decide we want it (watch the
free-tier quota — 5k errors/mo).

## Env vars (4 per app)

| Var | Block | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | client | Public DSN. Browser **and** server read it. Unset → inert. |
| `SENTRY_ORG` | server | Build-time only (source-map upload). |
| `SENTRY_PROJECT` | server | Build-time only. |
| `SENTRY_AUTH_TOKEN` | server | Build-time only. **Plain Text in Vercel, NOT Sensitive** — Sensitive vars aren't readable to the build, so the upload would silently skip. |

Infisical routing: `/web` and `/admin`, env `preview` + `prod`. Validated in
`apps/{web,admin}/src/env.ts` (all optional). See the `env-deploy` skill.

## tRPC server-side capture (the one manual bridge)

tRPC **catches** errors thrown in procedures and formats them — they never
bubble to Next's `onRequestError`. So `@saas/api` carries an optional,
SDK-agnostic `captureError` binding on the context (like `analytics` / `flags`):

- `packages/api/src/trpc.ts` — `withErrorCapture` middleware (outermost on
  `baseProcedure`) calls `ctx.captureError(error, { userId, path, type })` for
  **unexpected** errors only. Expected 4xx (`BAD_REQUEST`, `UNAUTHORIZED`,
  `FORBIDDEN`, `NOT_FOUND`, `TOO_MANY_REQUESTS`, …) are in `EXPECTED_ERROR_CODES`
  and skipped, so Sentry only sees real bugs (chiefly `INTERNAL_SERVER_ERROR`).
- `apps/{web,admin}/src/lib/sentry.ts` exports `captureError: CaptureError`,
  bound in each app's `app/api/trpc/[trpc]/route.ts` context. It attaches user
  context **per-event** (`captureException(err, { user: { id } })`), never via
  global `setUser` — that would leak identities across concurrent requests in a
  warm server runtime.

To capture in a non-tRPC handler, call `Sentry.captureException` directly (it's
a no-op when uninitialized).

## Gotchas

- **`tunnelRoute: "/monitoring"`** proxies browser events through a same-origin
  path to dodge ad blockers. It's locale-agnostic and **excluded from the
  next-intl proxy matcher** in `proxy.ts` (alongside `api|trpc`) — otherwise an
  error POST from a logged-out user gets redirected to sign-in and is lost.
- **Service worker (web):** the tunnel is a POST; Serwist's `defaultCache` only
  caches GET navigations/assets, so it passes through untouched — no `app/sw.ts`
  change needed. (If you ever add GET traffic under `/monitoring`, revisit.)
- **Source maps + Turbopack:** both apps `next build --webpack` (only admin's
  *dev* uses `--turbopack`), so the Sentry webpack plugin uploads maps normally —
  the Turbopack-source-map caveat doesn't apply to production builds here.
- **No upload without creds:** with `SENTRY_AUTH_TOKEN`/`ORG`/`PROJECT` unset the
  build still succeeds; it just skips the upload (warns). Stacks stay minified
  until the creds land.

## One-time setup (manual — no MCP for Sentry)

1. Create a Sentry org + two projects (`next-saas-boilerplate-web`, `next-saas-boilerplate-admin`, platform
   `javascript-nextjs`), mirroring the two Better Stack sources.
2. Copy each project **DSN** → Infisical `/web` + `/admin` as
   `NEXT_PUBLIC_SENTRY_DSN` (preview + prod).
3. Create an org **auth token** (scope: source-map upload) → `SENTRY_AUTH_TOKEN`,
   plus `SENTRY_ORG` / `SENTRY_PROJECT`. Keep the token **Plain Text** in Vercel.

## Verify (on a preview deploy — local dev has Sentry off)

1. Trigger a client crash → issue appears in `next-saas-boilerplate-web` with a **readable,
   source-mapped** stack, `environment: preview`, release = commit SHA.
2. Force a tRPC `INTERNAL_SERVER_ERROR` → captured **with `userId`**; force a
   `BAD_REQUEST` → **not** captured (expected-error filter).
3. Confirm Better Stack still gets `log.error` records — the two run
   independently.

Pairs with: `better-stack` (logs/perf/uptime), `log` (the logger), `env-deploy`
(secrets routing), `vercel` (build env), `pwa` (service worker).
