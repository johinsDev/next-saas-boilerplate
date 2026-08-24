---
name: env-deploy
description: Single source of truth for env vars (Infisical) and the reproducible dev/preview/prod deploy pipeline. Use when adding or rotating a secret, wiring an env into web/admin/jobs/partykit, setting up local dev, debugging "missing env" on a deploy, or onboarding a teammate to "where do secrets live and how do they reach each runtime".
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

# env-deploy — secrets + deploy runbook

**Infisical is the single source of truth for every secret**, across three
environments (`dev`, `preview`, `prod`). Nothing is hand-entered into Vercel,
Trigger.dev or PartyKit anymore — those receive their env *from* Infisical.

This skill grows one section per delivery phase:

| Phase | PR | Status |
| --- | --- | --- |
| 1 — Infisical source of truth | `chore(env): adopt Infisical` | merged (#44) |
| 2 — Dockerized local stack | `feat(dev): docker + sandbox` | merged (#45) |
| 3 — Preview pipeline (Turso clone + mask + Vercel wiring) | `feat(repo): preview pipeline on Turso` | merged (#51) |
| 4 — Prod pipeline (migrations + Worker + Trigger + Sentry + Slack) | `ci(prod): …` | merged (#96 #97) |
| 5 — Hardening + check-env gate | `docs(env-deploy): …` | planned |

> **Production architecture is live.** The backend is a standalone Hono API
> on Cloudflare Workers (`api.t4diverclub.app`); the Next apps are pure clients.
> The env × provider matrix, the prod deploy pipeline and the Infisical folder
> structure below reflect that end state. The README has the architecture
> diagram; this skill is the secrets + deploy operational runbook.

---

## Mental model

```
                ┌──────────────────────────────────────────┐
                │            Infisical project              │
                │            "next-saas-boilerplate"                  │
                │                                           │
                │  env: dev      env: preview   env: prod   │
                │  ──────────    ────────────   ─────────   │
                │  folders (exist in every environment):    │
                │    /shared   db, providers, R2, NEXT_PUBLIC_* │
                │    /api      Worker-only secrets (not FE)  │
                │    /ci       deploy creds (CF/Vercel/Turso…)│
                │    /mcp      Claude MCP tokens             │
                └───────┬───────────┬───────────┬───────────┘
                        │           │           │
        local dev ──────┘           │           └────── CI (GHA)
   scripts/with-infisical.sh        │            infisical run (Fase 3/4)
   infisical run --recursive        │
                                    │
                          Infisical→Vercel native sync
                       (preview/prod, scoped per folder)
                     web project ← /shared+/web
                     admin project ← /shared+/admin
```

`/mcp` is **never** synced to a deploy target — those tokens are local
tooling + CI only (Better Stack MCP, Slack MCP, later Sentry CLI).

The full variable → folder → env matrix lives in **`.env.example`** (read
the header block). `.env.example` is the human-readable matrix; Infisical
holds the values.

### Infisical folder structure (post-Worker)

| Folder | Consumed by | Examples (key names only) |
| --- | --- | --- |
| `/shared` | FE apps (web/admin) + jobs — app config, FE-facing | `DATABASE_URL`, `*_PROVIDER`, `R2_*`, `NEXT_PUBLIC_*` |
| `/api` | the API Worker **only** (NOT synced to the FE Vercel projects) | `BETTER_AUTH_SECRET`, `TURSO_AUTH_TOKEN`, `UPSTASH_*`, `GOOGLE_CLIENT_*`, `TRIGGER_SECRET_KEY`, `REALTIME_AUTH_SECRET`, Sentry DSN, Better Stack source |
| `/ci` | deploy creds — GHA workflows + manual deploy scripts | `CLOUDFLARE_*`, `VERCEL_*`, `TURSO_*`, `TRIGGER_ACCESS_TOKEN`, `PARTYKIT_LOGIN`/`PARTYKIT_TOKEN`, `SLACK_DEPLOY_WEBHOOK_URL` |
| `/mcp` | Claude Code MCP + local tooling **only** | `BETTER_STACK_API_TOKEN`, `SLACK_BOT_TOKEN` |

`/api` is the Worker's vault — it holds the secrets that used to live in the
Next apps' env (Better Auth secret, Google OAuth, Trigger key…). Because the
Worker is now the single auth issuer + tRPC server, those secrets **must not**
be synced to the FE Vercel projects; `/shared` is the only folder that reaches
the FE. `/ci` holds every deploy credential — the GitHub Actions workflows pull
it via `infisical run --env=prod` (the only GitHub secrets are the Infisical
machine identity).

### Environment × provider matrix (the target per environment)

Each `*_PROVIDER` / channel resolves to a real provider or a no-op per
environment. This is the **target**; the "Current state vs target" note below
flags the rows that aren't fully wired yet.

| Concern | Dev | Preview | Prod |
| --- | --- | --- | --- |
| Logs | console | console | Better Stack |
| A/B testing | PostHog | PostHog | PostHog |
| Events / analytics | PostHog | PostHog | PostHog |
| Auth — web | Google + Phone OTP | Phone OTP | Google + Phone OTP |
| Auth — admin | Password + Magic Link | Password + Magic Link | Magic Link |
| Email | console | outbox | Resend |
| SMS | console | outbox | Twilio |
| WhatsApp | console | outbox | Twilio |
| Push (web) | console | VAPID web-push | VAPID web-push |
| Storage | local | R2 + per-PR folder | R2 |
| Images | next (default) | next (default) | Cloudflare Images |
| Realtime | PartyKit (local :1999) | PartyKit + per-PR room prefix | PartyKit |
| Cron | Trigger.dev | Trigger.dev | Trigger.dev |
| Background tasks | Trigger.dev | Trigger.dev | Trigger.dev |
| Error tracking | null | null | Sentry |
| Cache | redis (Docker) | memory | Upstash |
| Rate limit | redis (Docker) | memory | Upstash |
| DB | SQLite (local) | Turso per-PR branch/clone | Turso |

**Current state vs target** — the matrix is the target; not every row is wired:

- **Auth — admin**: matrix targets Magic Link in prod; admin **currently uses
  Google** in prod. Current = web phone-OTP + admin Google. A deferred auth
  refactor moves web → Google-only and admin → password + passwordless
  (Magic Link).
- **Email prod creds** (Resend) **now live in Infisical** `prod:/shared`
  (`RESEND_API_KEY` + `EMAIL_FROM` + `EMAIL_PROVIDER`) and are pushed to the
  Trigger env by `syncEnvVars` on deploy (since 2026-06-09). **SMS / WhatsApp**
  (Twilio) creds still live in the **Trigger.dev dashboard** (the jobs send
  them) — not in Infisical yet, so `syncEnvVars` leaves them untouched.

---

## Prod deploy pipeline (a merge to `main` ships the backend)

Front-ends auto-deploy via Vercel's Git integration on every push to `main`.
Everything else ships from two path-filtered GitHub Actions workflows, both
gated on the repo variable `PROD_DEPLOY_ENABLED=true`:

```
push to main
   ├─ apps/api/** or packages/** ─▶ .github/workflows/deploy-prod.yml
   │     1. DB migrate (prod Turso)        (idempotent; runs first)
   │     2. API Worker deploy (code only)  WORKER_DEPLOY_SKIP_SECRETS=true
   │     3. Trigger.dev jobs deploy + env sync  (syncEnvVars UPSERTS)
   │     4. Slack summary (inert until SLACK_DEPLOY_WEBHOOK_URL set)
   │
   └─ partykit/** ────────────────▶ .github/workflows/deploy-partykit.yml
         redeploy the PROD party (realtime.t4diverclub.app) only
```

- **`deploy-prod.yml`** runs **migrate → Worker → Trigger** in order (code never
  deploys against an un-migrated DB). The Worker deploy is **code-only**
  (`WORKER_DEPLOY_SKIP_SECRETS=true`) — its secrets persist across deploys; run
  `bun run worker:deploy:prod` locally to re-sync after rotating one. The
  Trigger step's `syncEnvVars` (in `trigger.config.ts`) **upserts** — it pushes
  every listed key present in the Infisical-injected env (DB/auth/realtime/VAPID
  **and** `RESEND_API_KEY`/`EMAIL_FROM`/`EMAIL_PROVIDER`/Twilio), and leaves keys
  Infisical doesn't provide at their existing Trigger-dashboard value. **It runs
  on `trigger deploy` only — see the `trigger dev` gotcha below.**
- **`deploy-partykit.yml`** redeploys the **prod party only**. Two known gaps:
  it does **not** redeploy the staging party (redeploy it separately on
  `partykit/**` changes), and it needs `PARTYKIT_TOKEN` in Infisical prod `/ci`
  to authenticate (the local token is a rotating Clerk session; CI needs a
  stable one). Until that's set, `bun run partykit:deploy` is the manual path.
- **Manual deploys**: `bun run worker:deploy:prod` (full Worker + secrets re-push)
  and `bun run partykit:deploy` (the party).
- **Auth**: both workflows use the **same single Infisical machine identity**
  (`INFISICAL_MACHINE_IDENTITY_CLIENT_ID` / `_SECRET`) — the only GitHub
  secrets. Cloudflare/Vercel/Turso/Trigger/PartyKit creds all come from
  Infisical prod `/ci` + `/api` + `/shared` via `infisical run --env=prod
  --recursive`.

### Per-PR preview Worker

`preview.yml` deploys a per-PR Worker `next-saas-boilerplate-api-pr-N` at
`api.pr-N.t4diverclub.app` (generated `wrangler.preview.toml`), wires the FE
subdomains `admin.pr-N` / `app.pr-N`, and pins `NEXT_PUBLIC_API_URL` to the PR
Worker before the build so the FE points at it. The cookie domain is scoped to
`.pr-N.t4diverclub.app` (no leak across PRs/prod). `preview-cleanup.yml` tears
it all down on PR close.

### Pending one-time configs (TODO)

- Rotate the Upstash token (deferred — cache unused so far).
- Add `SLACK_DEPLOY_WEBHOOK_URL` to Infisical prod `/ci` to arm the Slack notify.
- Add `PARTYKIT_TOKEN` to Infisical prod `/ci` to arm `deploy-partykit.yml`.
- Add a staging-party redeploy step to `deploy-partykit.yml`.
- Step-6 FE env trim: drop the now-unused Next `/api/trpc` + `/api/auth` routes,
  make the FE env optional for DB/auth when going via the Worker.

---

## One-time setup (per machine / per teammate)

```bash
brew install infisical/get-cli/infisical     # CLI
infisical login                               # browser auth
infisical init                                # pick the "next-saas-boilerplate" project
                                              # → writes .infisical.json (commit it)
```

The Infisical project must have exactly three environment **slugs**:
`dev`, `preview`, `prod`. New Infisical projects ship `dev / staging / prod`
— rename `staging` → slug `preview` in the dashboard (Project → Settings →
Environments). The folder structure is created by the bootstrap script.

### Migrating an existing `.env`

```bash
bun run env:bootstrap                              # create folders in all 3 envs
bun run env:bootstrap -- --import .env --env dev   # push your old .env → dev folders
```

`scripts/infisical-bootstrap.sh` routes each variable to its folder using
the same matrix as `.env.example` (`folder_for()` in the script). Re-running
is safe (folders tolerate "exists", `secrets set` upserts). After importing,
adjust `preview`/`prod` values in the dashboard or via
`infisical secrets set KEY=VALUE --env=prod --path=/shared`.

---

## Daily local dev

Nothing changes in how you run things:

```bash
bun run dev          # web :3002 + admin :3003
bun run db:migrate
bun run jobs:dev
bun run partykit:dev
```

These are wrapped by `scripts/with-infisical.sh`, which:

- injects secrets via `infisical run --env=${INFISICAL_ENV:-dev} --recursive`
  when the CLI is installed **and** `.infisical.json` exists **and** you are
  not in CI;
- otherwise **falls back to running the command unchanged** (the old
  `.env` / direnv path). So the migration is non-breaking: before you run
  `infisical init`, everything works exactly as before.

Knobs:

- `INFISICAL_ENV=preview bun run dev` — run locally against the preview env.
- `NO_INFISICAL=1 bun run dev` — force the `.env`/direnv fallback.

Helper scripts:

- `bun run env:pull` — regenerate `.env` from Infisical in place (preserves the `INFISICAL_UNIVERSAL_AUTH_*` bootstrap creds; no `> .env`). See "Pulling an env locally".
- `bun run env:check` — list every secret in the current env (all folders).

---

## Local dev — the standard flow (services in Docker, apps on host)

This is the recommended loop. **Infisical's `dev` env is the source of truth**
for all env; **Docker runs the backing services** (libSQL + redis); the **Next
apps run natively on the host** for fast HMR. Trigger.dev always stays a host
process (its `dev` needs the cloud).

```
backing services (Docker)        apps (host, via `bun run dev`)
  libsql  :8080  (sqld)            web      :3002
  redis   :6379                    admin    :3003
  partykit :1999 (opt-in)          storybook :6006 + jobs (Trigger)
```

### Zero-to-running (new contributor)

```bash
# host tools: bun, Docker Desktop, infisical CLI (brew installs) + git
bun install
infisical login                 # must be invited to the Infisical `next-saas-boilerplate` project
bun run dev:services            # Docker: libsql :8080 + redis
bun run db:migrate              # Infisical → DATABASE_URL=http://localhost:8080 → migrate local libsql
bun run dev                     # web + admin + storybook + jobs on the host
# optional: bun run db:seed:owner --email=… · bun run jobs:dev · docker compose up partykit
```

`bun run dev:services:down` stops the services (the libSQL volume persists).

### The Infisical `dev` env (what's the source of truth)

Project `next-saas-boilerplate`, env `dev`, folder `/shared`. All values are **local /
host-addressed** so the host apps wire to the Docker services:

```
DATABASE_URL=http://localhost:8080      # local libSQL (no TURSO_AUTH_TOKEN for local)
CACHE_PROVIDER=memory                   # redis is up but unused unless you flip this
WHATSAPP/SMS/EMAIL/PUSH_PROVIDER=log    # nothing leaves the machine
STORAGE_PROVIDER=local · LOG_CHANNEL=pino · LOG_LEVEL=debug
PARTYKIT_HOST / NEXT_PUBLIC_PARTYKIT_HOST=localhost:1999
BETTER_AUTH_SECRET · REALTIME_AUTH_SECRET · TRIGGER_PROJECT_ID · GOOGLE_CLIENT_ID/SECRET
```

**`infisical run` overrides the shell env** — verified. Even though direnv's
`dotenv` exports `.env` into the shell on `cd`, `bun run dev`
(= `infisical run --env=dev --recursive -- turbo run dev`) injects the `dev`
values *over* any stale shell value, so a leftover `DATABASE_URL` in `.env`
can't shadow the local libSQL. `.env` only needs the MCP/tooling tokens that
must exist before Infisical (Better Stack, Slack, the Infisical machine-identity
creds).

**`partykit` is excluded from `bun run dev`** (`--filter=!@saas/partykit-server`)
because its dev server crashes under bun — it runs in Docker on Node instead.
Bring it up with `docker compose up partykit` only when working on realtime.

---

## Alternative: the whole stack in Docker (Fase 2)

`bun run dev:docker` brings up the whole stack offline **except Trigger.dev**
(its `dev` needs the cloud — keep running `bun run jobs:dev` on the host).

```
docker-compose.yml services:
  libsql       ghcr.io/tursodatabase/libsql-server (sqld), named volume, host port 8080
  redis        redis:7 (only for CACHE_PROVIDER=redis; default is memory)
  migrate      one-shot: waits for libsql, applies Drizzle migrations, exits
  partykit     npx partykit dev :1999
  web          bunx next dev --webpack :3002
  admin        bunx next dev --turbopack :3003
```

No custom image — the official `oven/bun:1.2.10` runs everything. A
one-shot `deps` service runs `bun install --frozen-lockfile` into the
shared `node_modules` volume and exits; web/admin/partykit wait for it via
`depends_on: { condition: service_completed_successfully }`, so three
containers never race the same install. bun hoists the whole workspace to
the repo-root `node_modules`, so one install serves every app; services
differ only by `working_dir` + `command`. The repo is bind-mounted for HMR.

### The DATABASE_URL detail

Compose **hardcodes** `DATABASE_URL=http://libsql:8080` for every service
(NOT `${DATABASE_URL:-…}`), so docker dev always hits the LOCAL `sqld` —
never the remote Turso a host shell (direnv) or Infisical might export.
The `@libsql/client` driver (`client.ts`, `migrate.ts`) and drizzle-kit
(`db:push`, `db:studio`, dialect `turso`) all speak to it over HTTP; no
auth token is needed locally. From the host, reach it at
`http://localhost:8080` (published port).

The `migrate` one-shot applies the schema before web/admin boot, so the
stack comes up ready. To re-migrate from the host (e.g. after `db:generate`):

```bash
bun run dev:docker            # in one terminal (auto-migrates on up)
bun run db:migrate:docker     # waits for :8080, migrates the local libsql
```

### Offline / secrets

`docker-compose.yml` ships dev-safe `${VAR:-default}` fallbacks
(providers=log, cache=memory, storage=local, a throwaway
`BETTER_AUTH_SECRET`/`REALTIME_AUTH_SECRET`), so `dev:docker` works with
**no network and no Infisical**. `dev:docker` is wrapped by
`scripts/with-infisical.sh`, so when you *are* logged in, real `dev`
secrets override the fallbacks via compose `${VAR}` substitution.

### Sandbox — validate ONE real third party

`bun run sandbox -- --<channel>=<provider>` does an authenticated
round-trip to a single provider to prove your sandbox credentials work
from this machine (it does **not** exercise the `@saas/*` send paths):

```bash
bun run sandbox -- --whatsapp=twilio   # GET Twilio account (SID+token)
bun run sandbox -- --sms=twilio
bun run sandbox -- --email=resend      # GET Resend domains
bun run sandbox -- --cache=upstash     # Upstash REST /ping
bun run sandbox -- --db=turso          # select 1 via the libSQL driver
```

Keep sandbox creds in Infisical (e.g. a `/sandbox` folder) and run
`infisical run --path=/sandbox -- bun run sandbox -- --email=resend`.

---

## MCP + CI tokens (`/mcp` folder)

`.mcp.json` resolves `${VAR}` from the **process** environment. Two ways to
feed it from Infisical:

```bash
# launch Claude Code with /mcp secrets injected
infisical run --env=dev --path=/mcp -- claude

# or export them into the shell (direnv .envrc still works as fallback)
infisical export --env=dev --path=/mcp --format=dotenv > .env.mcp
```

Source of truth for `BETTER_STACK_API_TOKEN`,
`BETTER_STACK_TELEMETRY_API_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID`
(and later `SENTRY_AUTH_TOKEN`) is Infisical `dev:/mcp` (add `prod:/mcp`
only for tokens that genuinely differ in prod, e.g. a prod Sentry token).

---

## Vercel integration (deploy-time injection)

Configured **once in the Infisical dashboard** (Integrations → Vercel),
not in code:

- Infisical `staging`/`preview` → each Vercel project's *Preview* env.
- Infisical `prod` → each Vercel project's *Production* env.
- Scope per project — the FE projects sync from **`/shared` only** (the Worker's
  `/api` folder is NOT synced to Vercel; the FE is a thin client of the Worker):
  - `next-saas-boilerplate-web`   ← `/shared`
  - `next-saas-boilerplate-admin` ← `/shared`
  - `next-saas-boilerplate-storybook` ← `/shared` (minimal)

The API Worker does **not** deploy through Vercel — it ships via
`deploy-prod.yml` (see the prod deploy pipeline above), reading `/shared` +
`/api` from Infisical at deploy time.

After wiring, **stop hand-editing env in the Vercel dashboard** — it is
overwritten on the next sync. Change the value in Infisical instead.

`VERCEL_URL`, `VERCEL_ENV`, `VERCEL_PROJECT_PRODUCTION_URL` are injected by
Vercel itself — never put them in Infisical.

## CI (`validate`) stays on stubs

`.github/workflows/ci.yml` keeps running with hardcoded stub env (it only
lints/knip/typechecks/tests — no secrets needed). The wrapper detects
`CI=true` and skips Infisical, so a committed `.infisical.json` does not
break CI. Preview/prod **deploy** workflows (Fases 3–4) are the only ones
that call `infisical run` with a service token.

---

## Adding a new env var

Five steps. Skipping the `turbo.json` one is the classic footgun — Turbo's
strict env strips any var not declared there, so the app boots with it
`undefined` and `env.ts` throws "Invalid environment variables".

**1. Declare + validate it** (zod) where it's consumed:

| Consumer | File | Notes |
| --- | --- | --- |
| `apps/web` | `apps/web/src/env.ts` | `server` block; client-exposed vars (`NEXT_PUBLIC_*`) go in `client` + `experimental__runtimeEnv`. The FE is a thin client of the Worker — most server secrets belong on the Worker, not here. |
| `apps/admin` | `apps/admin/src/env.ts` | same shape. |
| `apps/api` (Worker) | `apps/api/src/lib/env.ts` | the Worker reads `process.env` (from `[vars]` + secrets); declare Worker-only secrets here. Store the value in Infisical `/api` (NOT synced to Vercel) and re-push with `bun run worker:deploy:prod`. |
| `packages/jobs` (Trigger) | `packages/jobs/env.ts` | `server` block; both this and the db client are **lazy** — read `env.X` inside a task's `run()`, never at module top-level. Add the key to `syncEnvVars` in `trigger.config.ts` to push it. |

Use `requireWhen(...)` for conditionally-required creds (required only when a
provider is selected), like the Twilio/VAPID/Upstash vars.

**2. Let it reach builds** — add the key (or a `PREFIX_*` wildcard) to
`turbo.json` `globalEnv`. `NEXT_PUBLIC_*` is already covered by the `build`
task's `env`.

**3. Store the value in Infisical** — env `dev`/`staging`/`prod`, folder
`/shared` (or an app folder). Via the dashboard, `infisical secrets set
KEY=VALUE --env=dev --path=/shared`, or the Infisical MCP.

**4. It reaches each runtime automatically:**

- **Local dev** — `bun run dev` = `infisical run --env=dev --recursive`, so a
  var in `dev` is injected. (`infisical run` overrides a stale shell value.)
- **Vercel preview** — Infisical `staging:/shared` → Vercel **Preview** target
  via the Secret Sync (auto). Per-PR values are pinned branch-scoped by
  `preview.yml`.
- **Vercel prod** — Infisical `prod` → Vercel **Production** via the sync.
- **Trigger.dev (jobs)** — add the key to the `syncEnvVars` list in
  `trigger.config.ts`; `trigger deploy` then pushes it into the Trigger env.

> **⚠️ Trigger.dev is a SEPARATE env store and does NOT auto-sync for local dev.**
> `syncEnvVars` is a *build extension* — it runs on `trigger deploy` (preview/prod),
> not on `trigger dev`. Local jobs runs read the Trigger.dev **Development** env
> vars from the dashboard, and those **override** the Infisical-injected
> `process.env` — so updating Infisical alone does **not** fix `trigger dev`. To
> fix local dev you must also set the var in the Trigger.dev Development env
> (dashboard, or Management API `POST /api/v1/projects/{ref}/envvars/{dev|prod}/import`
> with the PAT `TRIGGER_ACCESS_TOKEN` from Infisical `/ci`). This bit us 2026-06-09:
> Infisical had the valid `RESEND_API_KEY` but Trigger Development still had a dead
> key, so `trigger dev` kept 401-ing. preview/prod self-heal on the next deploy; dev
> never does.

**5. Document it** in `.env.example` (the matrix: var · consumer · scope ·
Infisical folder).

### Pulling an env locally

A teammate can hydrate a `.env` from any environment:

```bash
INFISICAL_ENV=staging bun run env:pull        # or dev / prod — writes .env IN PLACE
direnv reload                                 # pick up the regenerated .env
```

`env:pull` runs `scripts/env-pull.sh`: it exports each folder (`/ /shared /mcp
/api /ci`) — **not** `--recursive`, which `infisical export` doesn't support —
and **preserves** the `INFISICAL_UNIVERSAL_AUTH_*` bootstrap creds (they live
only in `.env`, never in the vault). **Never pipe `> .env`** — the redirect
truncates `.env` before the script can read the creds to preserve; the script
writes `.env` itself. A guard refuses to overwrite `.env` if the result has no
bootstrap creds (e.g. expired `infisical login`).

(Needs Infisical login + project membership. Note: `staging` is the preview
base and has **no** `DATABASE_URL` — that's per-PR — so for a local DB still
use the Docker `dev:services` flow.)

### Overriding one preview (e.g. real Twilio instead of outbox)

Branch-scoped Vercel env vars **override** the synced base, for that one PR
only. On the fix branch:

```bash
GIT_BRANCH=fix/twilio ENV_KEY=WHATSAPP_PROVIDER ENV_VALUE=twilio  bun run scripts/vercel/set-preview-env.ts
GIT_BRANCH=fix/twilio ENV_KEY=TWILIO_ACCOUNT_SID  ENV_VALUE=AC…   bun run scripts/vercel/set-preview-env.ts
# repeat for TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM, then redeploy
```

That preview sends real WhatsApp via Twilio; every other preview stays on
`outbox`. `unset-preview-env` (PR close) removes the overrides.

---

## Rotating a secret

1. `infisical secrets set KEY=NEWVALUE --env=prod --path=/shared`
   (or `/api` for a Worker-only secret; or the dashboard).
2. **FE (Vercel)**: redeploy (or wait for the next deploy) — the sync re-pushes
   `/shared`.
3. **API Worker**: re-run `bun run worker:deploy:prod` (a code-only auto-deploy
   skips secrets, so a rotated Worker secret needs this manual re-push).
4. **Trigger.dev**: the next `deploy-prod.yml` run re-syncs via `syncEnvVars`
   (upsert). **PartyKit**: re-run `bun run partykit:deploy` (the secret rides in
   via `--var`, not `partykit env push` — that targets PartyKit cloud).
5. If it is an `/mcp` token: restart your Claude Code session.

Never commit a real value to `.env.example` — it is the matrix, not a vault.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `bun run dev` says "infisical: not logged in" | You created `.infisical.json` (opted in) but lack a token. `infisical login`, or `NO_INFISICAL=1 bun run dev` to bypass. |
| Local dev still uses `.env`, not Infisical | No `.infisical.json` yet. Run `infisical init`. |
| CI fails calling infisical | The wrapper should skip on `CI=true`. Check the workflow isn't calling `infisical run` directly without a service token. |
| A var is missing only on Vercel preview | It is not in `/shared` or the app's folder, or the Infisical→Vercel integration scope excludes that folder. |
| `invalid_client` on Google | Worker is the auth issuer — `GOOGLE_CLIENT_*` live in Infisical `/api` and the redirect URI is `https://api.t4diverclub.app/api/auth/callback/google`. Preview uses a different client than prod (no per-PR wildcards), so Google is not used in preview. |
| Trigger deploy: "X is not set" | `deploy-prod.yml` syncs Trigger env via `syncEnvVars` (upsert) from Infisical prod. Add the key to the `syncEnvVars` list in `trigger.config.ts`; keys Infisical doesn't provide keep their Trigger-dashboard value. |
| `trigger dev` uses a stale/wrong secret (e.g. Resend 401) even after updating Infisical | `trigger dev` does NOT run `syncEnvVars` — it reads the Trigger.dev **Development** dashboard env, which overrides `process.env`. Update the var in the Trigger.dev Development env (dashboard or Management API), then restart `trigger dev`. See the ⚠️ box under "It reaches each runtime automatically". |
| A deployed task throws `MissingDependencyError` for a provider SDK that IS in `package.json` | The Trigger deploy prunes provider SDKs (they're in `build.external` + obfuscated dynamic import). Add the package to `additionalPackages` in `trigger.config.ts` too — package.json alone only fixes local `trigger dev`. |
| Worker missing a secret after rotation | Auto-deploys are code-only (`WORKER_DEPLOY_SKIP_SECRETS=true`). Re-push with `bun run worker:deploy:prod`. |
| `deploy-partykit.yml` does nothing / auth fails | Needs `PARTYKIT_TOKEN` in Infisical prod `/ci`; until then use `bun run partykit:deploy`. It also only redeploys the **prod** party — redeploy staging separately. |
| `dev:docker`: web/admin crash on boot | `env.ts` throws if `DATABASE_URL`/`BETTER_AUTH_SECRET` missing. The compose fallbacks cover this; if you overrode them with empty values, unset the override. |
| `dev:docker`: db calls fail with a fetch/HTTP error | The libsql server isn't reachable. Confirm `DATABASE_URL=http://libsql:8080` in the container and `libsql` is up (`docker compose logs libsql`). |
| `dev:docker`: `URL_PARAM_NOT_SUPPORTED: sslmode` | A stale Postgres `DATABASE_URL` (old Neon, with `sslmode`) leaked in. Compose hardcodes `http://libsql:8080`; if you see this, something overrode it — check `docker compose config` for the resolved value. |
| `db:migrate:docker` hangs | libsql not up yet — `wait-for-libsql.ts` polls `:8080`. Check `docker compose ps`. |

---

## Preview pipeline (Fase 3)

Every PR gets its own **anonymized copy of production** as a database.

```
PR opened/pushed ─▶ .github/workflows/preview.yml
   1. POST Neon /branch_anonymized  (parent = prod default branch)
        → masked copy, referential integrity intact, fresh each push
   2. db:migrate on the branch      (applies THIS PR's new migrations)
   3. pin DATABASE_URL on the Vercel web+admin preview for this branch
   4. comment on the PR
PR closed ────────▶ .github/workflows/preview-cleanup.yml
   delete the Neon branch · purge R2 pr-<n>/ · unpin the Vercel env
```

We use **Neon's native PostgreSQL Anonymizer** (`POST /branch_anonymized`
with `masking_rules`), not a hand-rolled UPDATE script: one call creates
the branch *and* masks it, and Neon preserves FK integrity. Masking is
*static* (permanent on the branch), so the branch is recreated from fresh
prod data on every push — Neon's recommended workflow.

### Masking rules

`config/neon-masking-rules.json` is the source of truth (schema → table →
column → `anon.*` function). Two intents:

- **Realistic fakes** (`anon.dummy_free_email/name/phone_number`) for
  emails / names / phones — preview data stays "very real".
- **Hard scrub** (`anon.partial(col,0,'redacted',0)`) for
  tokens/passwords/OAuth/private storage paths — destroyed, not faked.

FK columns and PKs are never masked (Neon keeps referential integrity, so
the next-saas-boilerplate graph stays realistic). `organization.name/slug` stay clear
(the franchise name isn't PII). Add a column → add a rule here; verify the
`anon.*` name against the Anonymizer version your Neon project ships.

### One-time setup

Repo **variable** `PREVIEW_PIPELINE_ENABLED=true` (the gate — both
workflows are inert until set, so this PR is non-breaking). Repo
**secrets**: `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_DATABASE_NAME`,
`NEON_ROLE_NAME`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID_WEB`,
`VERCEL_PROJECT_ID_ADMIN`. Optional: `NEON_PARENT_BRANCH_ID` (else the
project default branch), `VERCEL_TEAM_ID`, `R2_*` (only if you opt a
branch into real R2). Neon's anonymized-branch feature requires a plan
that includes it.

### Expensive third parties = outbox

Preview keeps Resend/Twilio on `outbox` (Infisical `preview` env +
the `VERCEL_ENV=preview` provider cascade) — no real sends, rows land in
the `*_outbox` tables, reachable from the `(dev)` views. No code here;
it's the Fase 1 matrix + existing cascade.

### Storage in preview

Previews default to `STORAGE_PROVIDER=memory` (the existing cascade when
`R2_BUCKET` is unset) — **zero R2 writes, zero saturation, no cleanup
needed**. To validate real R2 on one preview, use the per-branch override
below with the `pr-<n>/` key convention; `preview-cleanup.yml` purges
that prefix on close.

### Per-branch override (test a real third party on ONE preview)

All channels are `outbox` in preview (recipients are anonymized →
real sends would bounce). To make ONE preview branch use a real third
party, pin **branch-scoped** Vercel env vars with
`scripts/vercel/set-preview-env.ts` (`ENV_KEY`/`ENV_VALUE`, scoped to
`GIT_BRANCH`). Concrete — test real Resend on branch `fix/email`:

```bash
for kv in EMAIL_PROVIDER=resend \
          RESEND_API_KEY=re_xxx \
          "EMAIL_FROM=T4 <noreply@yourdomain>"; do
  GIT_BRANCH=fix/email \
  ENV_KEY="${kv%%=*}" ENV_VALUE="${kv#*=}" \
    bun run scripts/vercel/set-preview-env.ts
done
```

Same shape for `WHATSAPP_PROVIDER=twilio` + `TWILIO_*`, etc. Only that
preview changes; every other PR stays on `outbox`. On PR close,
`preview-cleanup.yml` removes **every** branch-scoped var (the pinned
`DATABASE_URL` and any overrides), so nothing leaks.

### Logging into a preview (anonymized data)

Masking fakes every email/phone, so you can't log in as a real user. The
pipeline RESTORES the owner's real email (`johinsdev@gmail.com`) on the
preview branch (matched via `member.role=owner` → `user_id`; the PK isn't
masked) so **Google login works for the owner**. To act as a cashier/staff
in a preview, the owner uses Better Auth **impersonate** — staff accounts
are not separately restored. (Built in Fase 4 alongside the Google
preview-vs-prod client split.)

### Observability in preview

No Better Stack in preview (prod-only). Errors → **Sentry with
`environment=preview`** (wired in Fase 4, enabled for preview AND prod,
not prod-only). Plain logs → Vercel runtime logs. That's the agreed
split: Sentry for exceptions, Vercel for logs.

### Cloudflare Workers (Hono API) in preview — DONE

The tRPC + Better Auth layer ships as a per-PR Worker. `preview.yml` deploys
`next-saas-boilerplate-api-pr-N` at `api.pr-N.t4diverclub.app` (a generated
`wrangler.preview.toml`), reading `/shared` + `/api` from Infisical, and pins
`NEXT_PUBLIC_API_URL` to it before the build so the FE points at the PR Worker.
FE subdomains `admin.pr-N` / `app.pr-N` are aliased alongside; the cookie domain
is `.pr-N.t4diverclub.app`. `preview-cleanup.yml` tears it all down on PR close.

---

## Future phases (placeholders — do not implement here)

- **Fase 5**: `check-env.ts` as a hard gate on preview + prod; secret
  rotation runbook across all surfaces; the step-6 FE env trim (make the FE
  env optional for DB/auth now that the Worker is the issuer + tRPC server).
