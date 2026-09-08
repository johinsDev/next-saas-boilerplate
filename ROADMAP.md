# Roadmap

What this boilerplate does not have yet, roughly in the order it is worth adding.
Nothing here is started — this is the list, not a status board.

## 1. The apps

`apps/api` is here. The rest are not, and this is the first gap because it is what makes
everything else demonstrable.

- ~~**`apps/web`**~~ — done as a **reference app**, not a finished product. Next 16 with
  `cacheComponents` and `partialPrefetching`, public by default: the proxy allow-lists the
  one gated segment instead of guarding everything, and the header's account slot renders
  for signed-in and anonymous visitors alike. Still needs the real product surface, i18n,
  and the realtime wiring below.
- ~~**`apps/admin`**~~ — done, same caveat. Staff-only: the proxy guards everything and
  names its exceptions, and `verifyAuth()` reads the membership row because a cookie is
  not a role. Still needs the actual admin screens.

Both are small on purpose. Their job is to be the shape every screen copies —
synchronous pages, `use cache` in the app rather than in `packages/services`,
`'use cache: private'` for the session read and nothing else, one Suspense boundary per
data-dependent section with a height-matched skeleton beside its component. Read
`.claude/skills/nextjs-app-architecture` and the amendment in `architecture-guard` before
adding a screen.
- ~~**`apps/api`**~~ — done. Hono on Cloudflare Workers, exporting `AppType`. Still needs
  auth middleware, rate limiting and the observability wiring the packages already provide.
- **`apps/web` realtime wiring** — `@saas/realtime` and the `partykit/` server are both
  here; nothing connects them yet because there is no client to connect.
- ~~**Astro landing**~~ — built as `apps/landing`. Static, zero JavaScript, shares
  `@saas/design-tokens` and nothing else. Still needs real copy and a deploy target.
- **Multi-provider subscriptions.** One `BillingProvider` port with Stripe, Polar and
  Mercado Pago adapters — the same shape every other package here uses (see
  `@saas/storage`, `@saas/sms`). Mercado Pago matters for LatAm and is usually the
  reason an off-the-shelf boilerplate has to be abandoned.
- **Webhook ingestion** with idempotency keys and replay tolerance. Providers resend;
  a boilerplate that assumes exactly-once delivery corrupts state in week one.
- **A credit ledger.** Append-only, never a mutable balance column: balance is a fold
  over entries. That is the only shape that survives refunds, chargebacks and
  concurrent spend.
- **Entitlements and quotas.** A single `can(user, capability)` seam that both the UI
  and the services ask, so a paywall never lives in two places.
- **The usual surface**: plans, upgrades and downgrades with proration, trials, dunning,
  a customer portal, invoices, tax.

## 3. Infrastructure already scaffolded elsewhere

Proven in `loyalty-app`, worth lifting once there are apps to attach them to.

- **Infisical** for secrets, with the `with-infisical.sh` wrapper and per-environment
  bootstrap.
- **CI/CD** — preview environments per PR: preview database, preview Worker, aliased
  domains, and teardown on merge.
- ~~**Docker** for local services (libSQL, Redis)~~ — `docker-compose.yml`, plus
  `bun run dev:services`. The API image is still not built.
- **Trigger.dev** — `@saas/jobs` is here with the generic tasks; the deploy pipeline
  and per-environment projects are not.
- ~~**Sentry**~~ — wired per app (`@sentry/nextjs` in web/admin, `@sentry/cloudflare`
  in the Worker), inert until a DSN exists. The Sentry project itself still does not.
  Costs the Worker +103 KiB gzip.
- **Better Stack** — `@saas/log` has the transport; the project and the dashboards do not
  exist.

## 4. In-app notifications

`@saas/notifications` (channels, contracts, opt-out) and the database tables are here.
What did not come across is the service layer, because resolving *who* to notify and
*how to reach them* is app-specific — in `loyalty-app` it read a `customer` table this
repo does not have.

- A `Notifiable` port the app implements.
- The feed service: read, mark-read, unread count.
- Preference resolution per channel, defaulting to subscribed.

## 5. Clients beyond the browser

- ~~**Expo mobile app**~~ — `apps/mobile` exists: Expo Router, theming from
  `@saas/design-tokens`, Metro configured for the workspace. Still needs
  `@better-auth/expo`, the Hono client, and screens.
- **Tauri desktop app** — **this does not belong here.** It shares almost nothing with
  the web stack, it drags in a Rust toolchain that every contributor then has to
  install, and most SaaS products never ship one. It should be its own template that
  consumes the published API, not a workspace in this repo.
- **Terminal CLI (Ink)** — a React renderer for the terminal. Small, self-contained,
  and genuinely useful for admin tasks. Worth a workspace.
- **Embeddable widget (Preact + Vite)** — the script tag customers paste into their own
  site. Preact rather than React because the whole point is bundle size. Needs its own
  constraints: shadow DOM for style isolation, a versioned embed URL, and an origin
  allowlist.
- **Browser extension** — Manifest V3, sharing the widget's API client.

## 6. Product surfaces

- **RAG over a vector database.** An `EmbeddingProvider` port and a `VectorStore` port
  (Turso native vectors, pgvector, Upstash Vector). The interesting part is not the
  retrieval, it is chunking, ingestion jobs, and citation-carrying results.
- **React PDF** — invoices and reports, rendered server-side, in a job rather than in a
  request.
- **Remotion** — programmatic video for marketing and for per-user generated clips.
- **MDX blog** — content-collections style: typed frontmatter, an index page, tags, RSS,
  OG images. Runs on the Astro landing rather than in `apps/web`.

## 7. Boilerplate hygiene

- ~~**Database migrations.**~~ — `packages/db/migrations/0000_initial_schema.sql`.
- ~~**A seed**~~ — `packages/db/src/seed.ts`. Two organizations on purpose: a single-org
  seed lets every multi-tenancy bug through untouched.
- **`packages/i18n`** — next-intl for web, the same catalogues for mobile.
- ~~**`packages/design-tokens`**~~ — built, and tested against `globals.css` so the two
  cannot drift.
- **E2E tests** — Playwright, the `apps/e2e` shape from `loyalty-app`.
