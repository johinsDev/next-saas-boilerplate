# Roadmap

What this boilerplate does not have yet, roughly in the order it is worth adding.
Nothing here is started — this is the list, not a status board.

## 1. The apps

`apps/api` is here. The rest are not, and this is the first gap because it is what makes
everything else demonstrable.

- **`apps/web`** — Next.js 16, `cacheComponents: true`, calling `packages/services`
  directly. See `.claude/skills/architecture-guard`.
- **`apps/admin`** — same, behind the role guard in `@saas/auth`.
- ~~**`apps/api`**~~ — done. Hono on Cloudflare Workers, exporting `AppType`. Still needs
  auth middleware, rate limiting and the observability wiring the packages already provide.
- **`apps/web` realtime wiring** — `@saas/realtime` and the `partykit/` server are both
  here; nothing connects them yet because there is no client to connect.
- **Astro landing** — static marketing site, its own deploy, sharing only the design
  tokens. Deliberately not Next: a landing page should not carry a React runtime.

**The app-level libraries arrive with the apps, not before.** `zustand`, `nuqs`,
`@tanstack/react-query`, `react-hook-form`, `zod` and `motion` are dependencies of a
Next.js app, not packages of their own — wrapping each in a `packages/*` would add a layer
that exists only to be maintained. Each already has a skill under `.claude/skills/`, so
the conventions are settled before the first line is written. Same for SEO: it is metadata
and route conventions inside `apps/web`, not something to abstract.

## 2. Billing and entitlements

The largest missing piece, and the one that makes it a SaaS boilerplate rather than an
app skeleton.

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
- **Docker** for local services (libSQL, Redis) and for the API image.
- **Trigger.dev** — `@saas/jobs` is here with the generic tasks; the deploy pipeline
  and per-environment projects are not.
- **Sentry** — nothing here yet, not even a package. In the source application it is
  wired per app (`@sentry/nextjs`, `@sentry/cloudflare`) rather than abstracted, which is
  the right call: the SDKs differ enough per runtime that a shared port would only get in
  the way. There is a `sentry` skill covering the setup.
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

- **Expo mobile app** — shares `@saas/auth` (bearer + `expoClient`) and reaches the API
  through `hc<AppType>`. **This belongs here**: it consumes the same services and the
  same contract, and a SaaS boilerplate without mobile forces the decision later, when
  it is expensive.
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

- **Database migrations.** Dropped on extraction, because they encoded the loyalty
  domain. Generate a fresh initial migration from the current schema.
- **A seed** that creates an organization, an owner, and settings.
- **`packages/i18n`** — next-intl for web, the same catalogues for mobile.
- **`packages/design-tokens`** in plain JS, because React Native cannot read CSS.
  `@saas/ui` is web-only: tokens are shared, components are not.
- **E2E tests** — Playwright, the `apps/e2e` shape from `loyalty-app`.
