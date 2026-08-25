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
- **Astro landing** — static marketing site, its own deploy, sharing only the design
  tokens. Deliberately not Next: a landing page should not carry a React runtime.

**The app-level libraries arrive with the apps, not before.** `zustand`, `nuqs`,
`@tanstack/react-query`, `react-hook-form`, `zod` and `motion` are dependencies of a
Next.js app, not packages of their own — wrapping each in a `packages/*` would add a layer
that exists only to be maintained. Each already has a skill under `.claude/skills/`, so
the conventions are settled before the first line is written. Same for SEO: it is metadata
and route conventions inside `apps/web`, not something to abstract.

## 2. Multitenancy: a database per tenant

**Decided: a database per tenant, always.** Not row-scoped, and not a hybrid where a
tenant can be promoted to its own. This is first because it is the most expensive thing
here to retrofit — it changes how a connection is resolved on every request, so every
feature built before it is a feature that has to be revisited.

Turso is the reason it is affordable: an idle database costs its storage and nothing else
— no connection pool, no process, no memory reservation — so a database per tenant is a
normal architecture rather than an extravagant one. 100 on the free tier, unlimited on
paid.

- **A control plane, and then the tenants.** One central database still has to exist:
  you cannot know which database to open until you know who the caller is and which
  organization they belong to. Users, organizations, memberships, billing and the audit
  trail stay central; domain data moves out. Drawing that line is the first task, not an
  implementation detail — put the wrong table in the tenant database and a support
  question needs a fan-out across every tenant to answer.
- **The row-scoped model this displaces.** `organizationId` is on `member`, `audit_log`
  and `organization_settings` today. Once the database *is* the boundary, those filters
  stop being what enforces isolation. Decide deliberately whether they stay as
  belt-and-braces or come out — leaving them half-applied is how you end up unsure which
  one is actually protecting you.
- **Provisioning.** `@tursodatabase/api` creates the database on signup, mints a scoped
  token, and tears it down on churn. Every one of those is a step that can fail halfway,
  so signup becomes a small saga rather than an insert.
- **Migrations are the real work, and they grow with the tenant count.** Turso's Multi-DB
  Schemas feature is **deprecated for new users as of 2026**, so schema changes have to be
  scripted through the Platform API, per database, with progress and resumability —
  running 4,000 migrations is not a deploy step that may fail at 3,200 and be retried from
  the top. Budget for this properly; it is the part that looks small and is not.
- **The connection seam already exists.** `createDb(config)` takes its URL and token as
  arguments precisely because Workers bind I/O per request. What has to go, for anything
  tenant-scoped, is the `db` module singleton — it reads `DATABASE_URL` from the
  environment, which is the one thing that cannot be right per tenant.
- **What gets harder.** Cross-tenant reporting becomes a fan-out. `db:seed:demo` needs a
  tenant to seed into. The SQL tests need a database per test tenant. None of these is a
  blocker; all of them are work nobody remembers to estimate.

## 3. Billing and entitlements

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

## 4. AI

The whole surface, on the AI SDK (`ai@7`, providers on `@ai-sdk/*@4`). One rule runs
through it, and it is the repo's existing rule: **a provider is an adapter behind a port,
with a fake** — the same shape as `@saas/email`, `@saas/sms` and `@saas/storage`. Models
change every few months; the code that calls them should not.

- **`packages/ai/core`** — the provider registry and model routing: one place that knows
  which model a capability resolves to, per tenant and per plan, so a downgrade is a
  configuration change rather than a code change. It also carries **usage metering**,
  which is where this meets the credit ledger in section 3: tokens in, tokens out, cost,
  attributed to a tenant. A ledger entry per call, appended, never a mutable balance.
- **`packages/ai/chat`** — conversations, streaming, and the two things that separate a
  demo from a product:
  - **Resumable streams** (`resumable-stream@2`) over the Upstash Redis that
    `@saas/cache` already wraps. Without them, a phone locking mid-answer loses the
    answer; with them the reconnect picks the stream back up.
  - **Memory**, which is really message persistence plus a summarisation strategy.
    Storing every turn forever and replaying it into the context window is the naive
    version and it gets expensive linearly.
  - **AI Elements** for the UI.
- **`packages/ai/rag`** — **on libSQL's native vectors, not pgvector.** This matters: the
  usual boilerplate answer assumes Postgres, and adding one purely for retrieval would
  mean two databases to migrate, deploy and back up. libSQL has `F32_BLOB` columns,
  `vector_distance_cos`, and ANN indexes through `libsql_vector_idx` (DiskANN). The
  interesting work is not the retrieval anyway: it is chunking, ingestion as a job rather
  than a request, and results that carry their citations.
  *(Supersedes the RAG bullet that used to sit under Product surfaces.)*
- **`packages/ai/image`**, **`packages/ai/tts`**, **voice** — smaller slices over the same
  core, each with its own port. Voice is the one to sequence last: it is the only one that
  needs bidirectional streaming, and it will expose whatever is wrong with the transport
  layer underneath.
- **Per-app surfaces** — `(apps)/chat`, `(apps)/image`, `(apps)/rag`, `(apps)/tts`, each a
  thin screen over the package. They are demos in the same sense `apps/web` is: the shape
  every real screen copies.

## 5. API keys and webhooks

Two halves of the same thing — how something that is not a browser talks to this, and how
this talks back.

- **API keys.** Better Auth has no `api-key` plugin (verified against 1.7.1: `bearer`,
  `jwt`, `one-time-token`, `access` and `device-authorization`, and nothing else), so this
  is ours to write. Store a hash and never the key; carry a short public prefix so a leaked
  key can be identified from a log without being usable; scopes; last-used; rotation with
  an overlap window, because a key that cannot be rotated without downtime never gets
  rotated.
- **Outbound webhooks.** HMAC-signed, with a timestamp in the signed payload so a captured
  request cannot be replayed a week later. Retries with backoff belong in `@saas/jobs` —
  Trigger is already here. A delivery log the customer can see, and a replay button, are
  what turn "your webhook is broken" from a support thread into a self-service action.
- **The shape already exists.** `packages/services` has `email-outbox`, `sms-outbox` and
  `whatsapp-outbox`; a webhook outbox is the same pattern with a different transport.
  Write it that way rather than inventing a fourth shape.
- **`device-authorization` is the CLI story**, and it is worth doing properly: the terminal
  shows a code, the browser approves it, the CLI stores a token. Never ask for credentials
  in a terminal.

## 6. Infrastructure already scaffolded elsewhere

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

## 7. In-app notifications

`@saas/notifications` (channels, contracts, opt-out) and the database tables are here.
What did not come across is the service layer, because resolving *who* to notify and
*how to reach them* is app-specific — in `loyalty-app` it read a `customer` table this
repo does not have.

- A `Notifiable` port the app implements.
- The feed service: read, mark-read, unread count.
- Preference resolution per channel, defaulting to subscribed.

## 8. Clients beyond the browser

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

## 9. Product surfaces

- **Cookie consent**, with more than one provider behind a port — the same shape as every
  other integration here. It is not a banner: it is a consent state that `@saas/analytics`
  and PostHog have to *ask* before they load, which means the gate belongs below them
  rather than beside them. Getting that wrong is how a boilerplate ships a GDPR banner
  that does nothing.
- **React PDF** — invoices and reports, rendered server-side, in a job rather than in a
  request.
- **Remotion** — programmatic video for marketing and for per-user generated clips.
- **MDX blog** — content-collections style: typed frontmatter, an index page, tags, RSS,
  OG images. Runs on the Astro landing rather than in `apps/web`.

## 10. Deployment: Cloudflare

Next on Workers through **OpenNext**, with `wrangler.jsonc`, an `open-next.config.ts`, and
an R2 bucket for the incremental cache — kept separate from the bucket holding user
uploads.

This is shorter here than the usual guide suggests, and for a reason worth knowing: those
guides bind **Hyperdrive** to pool Postgres connections. There is no Postgres here, and
`@saas/db` already speaks HTTP through `@libsql/client/web` — that choice was made for
exactly this. `apps/api` is on Workers already.

What actually bites:

- **No Edge runtime.** Routes run on the Node.js runtime OpenNext provides; a route that
  opts into Edge is a route that will not deploy.
- **Script size.** Wrangler prints the compressed upload size — watch it, because the
  failure arrives at deploy time, after everything else has passed.
- **`nodejs_compat` is partial.** Anything Node-only has to become an HTTP or fetch
  equivalent. Most of this repo is already there; the exception is whatever a new
  dependency drags in, so it is worth checking at the point a dependency is added rather
  than at the point a deploy fails.

## 11. Boilerplate hygiene

- ~~**Database migrations.**~~ Done: `migrations/0000_*.sql`, generated from the current
  schema.
- ~~**A seed**~~ Done: `db:seed:owner <email>` creates the organization, the user and the
  membership, and sets Better Auth's admin capability flag — without which the owner gets
  403 from impersonation, ban and session revocation. `db:seed:demo` adds 65 sample
  accounts, every row prefixed `demo_` so `--clear` can never touch a real one.
  Organization *settings* are still unseeded.
- **A local database.** `@saas/db` builds its client from `@libsql/client/web`, which
  speaks only HTTP — deliberate, because the same client runs in a Worker, but it means
  there is no `file:` or `:memory:` path. `migrate`, both seeds and the users slice's SQL
  tests all need a reachable libsql (`turso dev`, or Turso itself). The SQL tests skip
  themselves unless `TEST_DATABASE_URL` is set, and what they cover is not reachable any
  other way.
- **`packages/i18n`** — next-intl for web, the same catalogues for mobile.
- **`packages/design-tokens`** in plain JS, because React Native cannot read CSS.
  `@saas/ui` is web-only: tokens are shared, components are not.
- **E2E tests** — Playwright, the `apps/e2e` shape from `loyalty-app`.
