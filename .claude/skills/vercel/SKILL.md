---
name: vercel
description: Deploy and operate the next-saas-boilerplate monorepo on Vercel. Use when adding a new app to Vercel, debugging a failed build, configuring env vars, rolling back a deploy, connecting Vercel to Better Stack uptime monitors, or onboarding a teammate to "how is the deploy wired".
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

# Vercel — deploy guide for the monorepo

`next-saas-boilerplate` is a Turborepo with Bun. We deploy each Next.js app as its own Vercel project that points at the same GitHub repo with a different `Root Directory`. **Vercel's native Git auto-deploy is the canonical deploy path** — push to `main` triggers a Production deploy; opening a PR triggers a Preview deploy. CI (`.github/workflows/ci.yml`) only validates; it does NOT run `vercel build` (see the `ci-cd` skill for the why).

This skill is the boilerplate to reproduce the setup on a new app or a new clone.

```
   github.com/johinsDev/next-saas-boilerplate
              │
              ├──► Vercel project: next-saas-boilerplate-web
              │      Root Directory: apps/web
              │      Build: cd ../.. && bun run turbo build --filter=@saas/web
              │      Env vars: DATABASE_URL, BETTER_AUTH_SECRET, etc. (Plain Text)
              │
              ├──► Vercel project: next-saas-boilerplate-admin
              │      Root Directory: apps/admin
              │      Build: cd ../.. && bun run turbo build --filter=@saas/admin
              │      Env vars: same as web + admin-specific
              │
              ├──► Vercel project: next-saas-boilerplate-storybook
              │      Root Directory: apps/storybook
              │      Build: cd ../.. && bun run turbo build --filter=@saas/storybook
              │      Framework: Other (static output → storybook-static/)
              │      Env vars: none (static, no auth, no DB)
              │
              └──► (future) next-saas-boilerplate-cashier, next-saas-boilerplate-marketing, etc.
```

The MCP at https://mcp.vercel.com/ (OAuth) gives us read access to projects, deployments, runtime logs, and build logs from inside Claude Code.

---

## 1. One-time prerequisites

- Vercel account → https://vercel.com/signup (you choose Hobby plan; upgrade later when you need teams/proddomain).
- GitHub repo connected: in Vercel → Account → Settings → Git → install GitHub app, grant access to `next-saas-boilerplate`.
- The repo's `package.json` at root pins `packageManager: "bun@<version>"`. Vercel auto-detects Bun and uses it.
- Each Vercel project's Settings → Git → Production Branch = `main`; "Automatically deploy on push" = on. Preview deploys are on by default.

---

## 2. Create a project (steps in the Vercel UI)

Replace `<app>` with `web` or `admin` in every step.

### a) Import

1. https://vercel.com/new → search for `next-saas-boilerplate` → **Import**.
2. Project Name: `next-saas-boilerplate-<app>`.

### b) Framework + monorepo settings

3. Framework Preset: **Next.js** (auto-detected).
4. Root Directory: click **Edit** → select `apps/<app>`.
5. Expand **Build & Output Settings** → toggle "Override":

| Setting | Value |
| --- | --- |
| Build Command | `cd ../.. && bun run turbo build --filter=@saas/<app>` |
| Install Command | `cd ../.. && bun install` |
| Output Directory | leave default (`.next`) |

> Why `cd ../..`: Vercel runs from the Root Directory by default. The monorepo's workspace + Turborepo cache live at the repo root, so the build needs to invoke `turbo` from there with a `--filter` to build only the relevant app.

### c) Environment Variables

Paste from the per-service section of `.env.example` (see the .env.example file for the canonical list). For `web` and `admin` minimum:

| Var | Value |
| --- | --- |
| `DATABASE_URL` | pooled Neon connection string |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | the deploy's URL (set after first deploy) |
| `NEXT_PUBLIC_APP_URL` | the deploy's URL |
| `BETTER_STACK_SOURCE_TOKEN_<APP>` | from BS source for that service |
| `BETTER_STACK_INGESTING_HOST_<APP>` | from BS source for that service |
| `LOG_LEVEL` | `info` |
| (admin only) `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud |

Apply them to **Production**, **Preview**, and **Development** unless you specifically want a difference.

#### Fast path: bulk-import from a local `.env.<env>` file

If you already have a local `.env` with the right values, the fastest way is via the Vercel CLI. **Run from the app directory** (each app is its own Vercel project):

```bash
# 1. Link this app dir to its Vercel project (one-time per clone).
cd apps/web
bunx vercel@latest link --yes --project next-saas-boilerplate-web

# 2. Make a clean file with only the vars this app needs (no MCP / .env.example
#    sections), then import it. `vercel env add` reads stdin or prompts;
#    a tight loop is the most reliable path:
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  printf '%s' "$value" | bunx vercel@latest env add "$key" production
done < .env.web.production
```

Repeat for `apps/admin` (project `next-saas-boilerplate-admin`). For preview environment, change `production` → `preview`.

UI alternative — Vercel project → Settings → Environment Variables → "Import .env" (paste the file contents).

#### Minimum to pass the CI deploy step

The build collects page data, which means it executes server modules at build time. If `DATABASE_URL` (or any var that's read at module scope) is missing, the build fails with `Error: <VAR> is not set` during "Collecting page data". For the very first deploy you can stub `BETTER_STACK_*` and `GOOGLE_*` (logger falls back to console; OAuth disabled) — but `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `NEXT_PUBLIC_APP_URL` must be real.

### d) Deploy

6. Click **Deploy**. First build is 3-5 min; the bun install + turbo build are warmed by the global build cache after the first run.

### e) Backfill the URLs

7. Once you have the assigned domain (e.g. `next-saas-boilerplate-web-<owner>.vercel.app`), come back to Settings → Environment Variables → fix `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` → **Redeploy** (Deployments → ⋯ → Redeploy).

### f) Add custom domain (when LOY-43 lands)

8. Settings → Domains → **Add** → `app.<dominio>` for web, `admin.<dominio>` for admin.
9. Vercel walks you through DNS records for Cloudflare (CNAME flattening). Cert is auto.
10. Update `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` again to the prod domain.

---

## 3. Operating the deploys with the MCP

Tools live under `mcp__vercel__*`. Load on demand:

```
ToolSearch select:mcp__vercel__list_teams,mcp__vercel__list_projects,mcp__vercel__list_deployments,mcp__vercel__get_deployment,mcp__vercel__get_runtime_logs,mcp__vercel__get_deployment_build_logs
```

### Common operations

| Goal | Tool | Notes |
| --- | --- | --- |
| Find your team id | `list_teams` | Vercel team ids start with `team_`. Personal accounts use the user id. |
| List projects | `list_projects` | Pass `teamId`. Returns project ids needed for everything else. |
| Last 50 deployments of a project | `list_deployments` | Pass `projectId` + `teamId`. |
| Get one deployment | `get_deployment` | `idOrUrl` accepts the deployment URL. |
| **Read runtime logs** | `get_runtime_logs` | Filter by `environment`, `level`, `statusCode`, `query` (full-text), `since`. |
| Read build logs | `get_deployment_build_logs` | Useful when a deploy stays "Failed". |
| Search Vercel docs | `search_vercel_documentation` | When the MCP can't surface a setting. |

### Reading runtime logs (most-used)

When something is wrong in prod and you want to see what happened in the last hour:

```
get_runtime_logs
  projectId="<id>"
  teamId="team_..."
  environment="production"
  level=["error", "fatal"]
  since="1h"
  limit=50
```

It pulls the same logs Vercel surfaces in the UI's Logs tab — `console.error`, unhandled promise rejections, function timeouts, edge errors. **They are NOT the same as Better Stack logs**: Vercel logs are short-retention (24-48h on Hobby) and unstructured-by-default. BS is the persistent search.

### Promoting a preview to prod

Hobby plan: every push to `main` auto-deploys to Production; every PR builds a Preview. There's no manual promote step. To roll back: Deployments → click the previous good deploy → ⋯ → **Promote to Production**.

### Rollback during an incident

1. Open the affected project in Vercel.
2. Deployments tab → find a deploy with green status from before the incident.
3. ⋯ menu → **Promote to Production**. Takes ~10s.
4. Open BS uptime monitor → confirm UP again.
5. Post in `#alerts-next-saas-boilerplate` what you did.

---

## 4. Connecting to other tools

### Better Stack uptime

The two uptime monitors poll `https://<vercel-slug>/api/health` (see `.claude/skills/better-stack/SKILL.md` for the full setup). Vercel and BS are decoupled — Vercel doesn't know BS exists; BS doesn't know about Vercel deploys. The connection is the public URL.

When Vercel's preview slug changes (e.g. you renamed the project), the monitor URL needs updating in BS. The BS MCP can do that with `uptime_update_monitor_tool` (... if the MCP exposes it; today the BS MCP is read-mostly for monitors so you may have to do it in the BS dashboard).

### Better Stack logs

Each app's bootstrap (`apps/<app>/lib/log.ts`) reads `BETTER_STACK_SOURCE_TOKEN_<APP>` from Vercel env vars. When that var is set, the logger auto-switches from `pino` to `better-stack`. No app code changes needed across environments — same code, different env vars.

### Trigger.dev

Doesn't deploy via Vercel. `packages/jobs` deploys directly to Trigger.dev cloud from the developer machine (`bun run jobs:deploy`). Trigger has its own env panel.

---

## 5. Conventions for this repo

- **One Vercel project per app** — never reuse a project across services.
- **Project naming**: `next-saas-boilerplate-<service>`. The Vercel slug becomes part of the preview URL.
- **Build command always uses `--filter=@saas/<service>...`** so Turbo only rebuilds what changed.
- **`packageManager` pinned in root `package.json`** so Vercel knows to use Bun.
- **Don't create `vercel.json` per app** unless you need cron, redirects, or specific framework overrides — Vercel UI handles the common case better and keeps config in one place.
- **Environment variables are per-Vercel-project**, not shared. Tedious but isolates accidents.
- **Preview auto-deploys on every PR**; Production auto-deploys on `main`. Before merging, open the Preview URL and curl `/api/health`.

---

## 6. Troubleshooting

### Build fails: "Cannot find module @saas/log"

Root Directory is set right (`apps/web`) but Vercel didn't `bun install` from the repo root. Check **Install Command**: must be `cd ../.. && bun install`. Without that, only `apps/web/node_modules` resolves and workspace deps are missing.

### Build succeeds, runtime fails: "DATABASE_URL is not set"

Missing env var on this project. Check Settings → Environment Variables → Production. Set it, then **Redeploy** (Vercel does NOT pick up new env vars on the existing deploy).

### Build in CI fails with "DATABASE_URL is not set" but the var IS set in Vercel

The var is probably marked **Sensitive**. Sensitive variables are encrypted at rest and Vercel only decrypts them inside its own runtime — they are NOT returned by `vercel pull` and NOT exposed to `vercel build` when the build runs outside Vercel infra (which is exactly our setup, since CI does `vercel build --prebuilt`).

Fix: Settings → Environment Variables → click `⋯` on each var → **Edit** → uncheck **Sensitive** → Save. If Vercel refuses to edit a Sensitive var's value, **Remove** it and re-add as Plain Text.

Plain Text doesn't mean "leaked": it's still encrypted at rest and in transit inside Vercel. It just means the project's CLI tokens (and our CI) can read it. Reserve Sensitive only for vars that are read **only** at runtime by Vercel-hosted code.

### `(0 , bun_1.spawnSync) is not a function` or similar Bun error

Bun version mismatch. Either:
- Bump `packageManager` in root `package.json` to a newer Bun.
- Or pin Vercel's Bun via env var `BUN_VERSION=1.2.10` in project settings.

### `dotenv: cannot find ./.env`

That's our `dev`/`build`/`start` script wrapping `next` with `dotenv -e ../../.env`. **Expected on Vercel** — the file doesn't exist there because env vars come from the panel. dotenv-cli passes through silently when the file is missing, so this is not actually an error; if you see Vercel logging it as a warning, ignore.

### Function timeout (10s on Hobby, 60s on Pro)

Hobby plan caps function execution at 10s. If a tRPC procedure takes longer (e.g. heavy DB query), it'll fail with `FUNCTION_INVOCATION_TIMEOUT`. Solutions:

- Optimize the query.
- Move the work to Trigger.dev.
- Upgrade the Vercel plan.

### Preview URL changed after rebrand

If you rename a project, the slug changes → BS monitor URL becomes stale. Update it in BS dashboard or via MCP. Same goes for adding custom domains.

### MCP `Authentication failed`

Re-trigger OAuth: `/mcp` → click the Vercel entry → Reconnect. The MCP token expires periodically; this re-runs the OAuth flow.

---

## 7. Migrating to Pro / Team plan (when needed)

Triggers to upgrade:

- Need more than 1 user editing.
- Function execution > 10s for production paths.
- Want to share Vercel team with the customer for status access.
- Want preview password protection (Pro feature).

Process:

1. Vercel dashboard → **Upgrade**.
2. Move all projects under the team.
3. Update GitHub app authorization to the team.
4. Rotate any service tokens that referenced the personal account.

---

## Where to look first

- This skill for the monorepo wiring.
- `.env.example` for the per-service env var lists.
- `apps/<app>/package.json` for the dev/build/start scripts.
- `apps/<app>/next.config.ts` for `transpilePackages` + framework config.
- `turbo.json` at the repo root for pipeline cache rules.
