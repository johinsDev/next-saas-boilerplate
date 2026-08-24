---
name: shortlinks
description: Self-hosted URL shortener for the next-saas-boilerplate — `@saas/shortlinks` (provider-agnostic, null + custom) backing SMS/WhatsApp links + click analytics. The redirect runs on the API Worker; rows live in Turso. Use when shortening a URL before a send, adding a shortlink from the admin, debugging the `/r/:slug` redirect or click counts, wiring a new environment, or adding a third-party provider.
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

# @saas/shortlinks — self-hosted URL shortener

Long URLs in SMS/WhatsApp burn segments (160 GSM-7 chars = 1 segment = $) and look ugly. This shortens them to `https://l.t4diverclub.app/r/<slug>` — **self-hosted, $0**, on the Cloudflare Worker + Turso we already pay for. Same provider-agnostic shape as `@saas/sms` / `@saas/cache` (Manager / Strategy / Fake), so a third-party (Dub/Bitly) drops in later without a rewrite.

---

## Where things live

| What | Where |
| --- | --- |
| Package (abstraction) | `packages/shortlinks/src/` |
| Manager + strategies | `manager.ts`, `strategies/{null,custom}.ts`, `fake.ts` |
| Slug generation | `packages/shortlinks/src/slug.ts` (`generateSlug` base62) |
| `ShortlinkStore` port | `packages/shortlinks/src/types.ts` |
| DB tables | `packages/db/src/schema/shortlinks.ts` (`shortlink` + `shortlink_click`) |
| API feature | `packages/api/src/features/shortlinks/` (router → service → repository + `store.ts` adapter) |
| Redirect endpoint | `apps/api/src/index.ts` (`GET /r/:slug`) |
| Worker bootstrap | `apps/api/src/lib/shortlinks.ts` (repository + manager + base URL) |
| ctx binding | `packages/api/src/trpc.ts` (`ShortlinksBinding`, `ctx.shortlinks`, `ctx.shortlinkBaseUrl`) |
| Admin UI | `apps/admin/app/[locale]/(dashboard)/shortlinks/**` + `apps/admin/src/features/shortlinks/**` |

---

## The two faces of a shortlink

1. **Creation** — turning a long URL into a slug + persisting `slug → target`. Goes through the **`@saas/shortlinks` manager** (`ctx.shortlinks.shorten(...)`), so slug-gen + dedupe live in one place (the `custom` strategy).
2. **Resolution (redirect)** — `GET /r/:slug` → 302 to the target + record a click. A **raw Hono route** on the Worker that hits the **repository directly** (not the manager).

Both write/read the same `shortlink` table via `@saas/db`. The package itself never imports Drizzle — the `custom` provider persists through an injected **`ShortlinkStore` port**, whose adapter (`createShortlinkStore(repo)`) lives in the API feature.

---

## Shortening a URL

```ts
// Through the ctx binding (admin create router):
const { shortUrl, slug } = await ctx.shortlinks.shorten(
  "https://app.t4diverclub.app/card",
  { organizationId, createdByUserId, slug: "promo", expiresAt },
);
// → https://l.t4diverclub.app/r/promo
```

- `slug` omitted → random base62 (~7 chars), retried on the rare unique collision.
- `slug` given → custom (manual create); rejected if taken (`SlugUnavailableError`).
- No custom slug → **dedupes** on `(organizationId, targetUrl)` among active rows, so re-sending the same campaign reuses one slug.
- `null` provider (dev) → returns the URL **unchanged** (passthrough), `slug: null`.

Non-http(s) URLs throw `InvalidUrlError`.

---

## Provider selection per environment

The manager bootstrap picks the provider; only the presence of a base URL makes `custom` usable.

| Env | Provider | `SHORTLINK_BASE_URL` | Redirect |
| --- | --- | --- | --- |
| **dev** | `null` (passthrough) | unset → Worker lib falls back to `http://localhost:8787/r` | local Worker `/r/:slug` |
| **preview** | `custom` | `https://api.pr-<n>.t4diverclub.app/r` (set per-PR by `scripts/cloudflare/deploy-preview-worker.ts`) | per-PR Worker, per-PR DB (isolated) |
| **prod** | `custom` | `https://l.t4diverclub.app/r` (committed `[var]` in `apps/api/wrangler.toml`) | **needs the `l.t4diverclub.app` route + DNS — Fase 4** |

**The Worker doesn't read `SHORTLINKS_PROVIDER`** — its redirect always works and its admin-create manager is always `custom`. `SHORTLINKS_PROVIDER` (`null`/`custom`) is only for the *send-time* path (jobs), once that's wired.

Env vars are documented in `.env.example` §12.5. `SHORTLINK_BASE_URL` always includes the `/r` path and has no trailing slash.

---

## The redirect endpoint

`GET /r/:slug` on the Worker (`apps/api/src/index.ts`):

1. Look up `slug → { id, targetUrl }` — cached in `caches.default` (~5 min) to skip the DB on hot slugs.
2. `repository.findActiveBySlug(slug)` checks `active` + `expiresAt`; missing/inactive/expired → **404**.
3. `302 Location: targetUrl`.
4. Click recorded via `c.executionCtx.waitUntil(...)` so it **never blocks** the redirect: a `shortlink_click` row (`country`/`city` free from `request.cf`, raw `userAgent`, `referer`) + `click_count += 1`.

---

## Analytics (admin)

Own table, own UI — no third-party. The admin detail page (`(dashboard)/shortlinks/[id]`) shows:
- total `clickCount` (denormalized on `shortlink`),
- clicks-by-day (`repository.clicksByDay`, SQLite `strftime` over `shortlink_click`),
- top countries (`repository.topCountries`).

The geo is captured at redirect time from Cloudflare's `request.cf` — no IP lookup, no cost.

---

## API surface (tRPC `shortlinks` router)

```ts
api.shortlinks.create({ targetUrl, slug?, expiresAt? });  // staffProcedure → goes through ctx.shortlinks
api.shortlinks.list({ search?, page, pageSize });          // staffProcedure
api.shortlinks.get({ id });                                // staffProcedure
api.shortlinks.analytics({ id, sinceDays });               // staffProcedure
api.shortlinks.deactivate({ id });                         // ownerProcedure
```

Responses carry `shortUrl` (built from `ctx.shortlinkBaseUrl`). The redirect is **not** a tRPC procedure — it's the raw Worker route.

---

## Testing

`ShortlinksManager.fake()` swaps in `FakeShortlinks` (records every `shorten()`):

```ts
const fake = shortlinks.fake();
await buildPromoSms();
fake.assertShortenedCount(1).assertShortened((c) => c.url.endsWith("/card"));
shortlinks.restore();
```

The `custom` strategy is unit-tested against an in-memory `ShortlinkStore` (`packages/shortlinks/src/__tests__/`) — slug-gen, dedupe, custom-slug conflict, invalid-URL, null passthrough.

---

## Adding a third-party provider (future)

The seam is ready — no abstraction change:

1. Add a config variant to `ProviderConfig` in `types.ts` (e.g. `DubProviderConfig`).
2. Implement `ShortlinksStrategy` in `strategies/<name>.ts` (`shorten()` calls the SDK/REST).
3. Wire it into the `createStrategy` switch in `manager.ts`.
4. Add it to the bootstrap's `providers` map, gated on its creds.

The custom provider stays as the default self-hosted path; a third party becomes opt-in per env.

---

## Follow-ups (not done in v1)

- **Send-time integration (jobs).** A notification's `toSms()`/`toWhatsApp()` calling `shorten()`. Deferred because the notification *builder* doesn't have the `organizationId` (the org is known at the `Notifier` level) — it needs an org-aware seam. The abstraction is ready; wire `@saas/shortlinks` into `packages/jobs` + thread the org through when building it.
- **Prod short host.** `l.t4diverclub.app` needs a wrangler `[[routes]]` entry + a DNS CNAME on the zone, landing with the prod Worker deploy (Fase 4). Until then the prod redirect 404s; preview exercises the real path on the per-PR Worker.

---

## Common pitfalls

- **`SHORTLINK_BASE_URL` must include `/r`** and have no trailing slash. The short URL is `${base}/${slug}`; the redirect route is `/r/:slug`. Mismatched base → links point at a 404.
- **The package is Drizzle-free on purpose.** Don't `import "@saas/db"` inside `packages/shortlinks` — persist through the `ShortlinkStore` port; the adapter lives in `packages/api/.../shortlinks/store.ts`.
- **Don't route the redirect through tRPC.** It's a public 302 with no auth + a `waitUntil` click write; keep it a raw Hono route so it stays fast and cacheable.
- **Slug is unique host-wide**, not per-org (the short domain is shared). Org scoping is on the row, not the slug.
- **Dev is passthrough.** With the `null` provider, `shorten()` returns the long URL — that's expected; you only see real short links in preview/prod (or by pointing dev at a `custom` base URL).
