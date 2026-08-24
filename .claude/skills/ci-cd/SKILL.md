---
name: ci-cd
description: GitHub Actions + branch protection + Vercel auto-deploy for the next-saas-boilerplate monorepo. Use when adding a CI step, debugging a failing run, configuring branch protection, opening a PR, or onboarding a teammate to "how does code reach production".
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

# CI / CD — pipeline cookbook

The contract is split: **GitHub Actions validates, Vercel deploys.** Every change goes through a Pull Request; `main` is locked.

```
   git push (any branch)
         │
         ▼
   ┌─────────────────────────────────────────────┐
   │ open a PR (gh pr create)                    │
   └─────────────────────────────────────────────┘
         │
         ▼
   ┌─────────────────────────────────────────────┐
   │ GitHub Actions — validate                   │
   │   bun install                               │
   │   lint  (oxlint via turbo)                  │
   │   knip  (dead code / unused deps)           │
   │   typecheck  (tsc via turbo)                │
   │   test  (vitest via turbo)                  │
   └─────────────────────────────────────────────┘
         │ green
         ▼
   ┌─────────────────────────────────────────────┐
   │ Vercel Git integration (auto-deploy)        │
   │   next-saas-boilerplate-web        → preview URL on PR│
   │   next-saas-boilerplate-admin      → preview URL on PR│
   │   next-saas-boilerplate-storybook  → preview URL on PR│
   └─────────────────────────────────────────────┘
         │
         ▼
   merge to main → Vercel re-deploys to production
```

The workflow is `.github/workflows/ci.yml`. Vercel watches the GitHub repo directly via its native integration — there is no `vercel build` step in CI.

---

## Why CI is validate-only (not deploy)

We tried CI-driven deploys with `vercel build --prebuilt` and hit a wall: env vars marked **Sensitive** in Vercel are encrypted at rest and only decrypted **inside Vercel's runtime**. `vercel pull` returns them empty when run from CI, so `vercel build` outside Vercel can't read `DATABASE_URL` and the build crashes.

Splitting the contract this way:

- Lets us keep Sensitive env vars Sensitive (no security regression).
- Lets Vercel's optimized builders do their thing (faster, with their cache).
- Keeps CI focused on the things only CI can do: lint, typecheck, test, dead-code detection.

When this trade-off would flip:

- Multi-target deploys (Vercel + AWS + …) — CI becomes the orchestrator.
- Compliance forbids SaaS builds — CI must own the build.
- Custom build steps Vercel can't run.

Until one of those lands, the pipeline stays simple.

---

## 1. One-time setup

### a) GitHub repo — branch protection

Settings → Branches → Add ruleset for `main`:

- ☑ **Restrict updates** — prevents direct pushes; PRs only.
- ☑ **Require a pull request before merging**:
  - Required approvals: **0** for solo dev (bump when team grows). Branch protection still requires the PR itself.
  - ☑ Dismiss stale reviews when new commits are pushed.
  - ☑ Require conversation resolution before merging.
- ☑ **Require status checks to pass**:
  - Required: `validate (lint, knip, typecheck, test)`.
  - ☑ Require branches to be up to date before merging.
- ☑ **Block force pushes**.
- ☑ **Block deletions**.
- ☑ **Require linear history** — squash/rebase merges only; cleaner main timeline.
- ☐ Skip "Require signed commits" — overhead, low value at MVP stage.

PR settings (Settings → General → Pull Requests):

- ☑ Allow squash merging — **default**.
- ☐ Disable merge commits.
- ☐ Disable rebase merging.
- ☑ Auto-delete head branches after merge.

### b) GitHub repo — secrets and variables

For Turbo Remote Cache (optional, Vercel Team plan only):

| Type | Name | What |
| --- | --- | --- |
| Secret | `TURBO_TOKEN` | Vercel turbo remote cache token. |
| Variable | `TURBO_TEAM` | Your Vercel team URL slug. |

For when E2E specs land (deferred today):

| Type | Name | What |
| --- | --- | --- |
| Variable | `WEB_PROD_URL` | Public URL of the customer PWA, e.g. `https://app.next-saas-boilerplate.com`. |
| Variable | `ADMIN_PROD_URL` | Public URL of admin, e.g. `https://admin.next-saas-boilerplate.com`. |

There are **no** `VERCEL_*` secrets in this repo. Vercel auto-deploy authenticates via the GitHub integration; no token is needed in CI.

### c) Vercel — confirm Git auto-deploy

Each Vercel project (`next-saas-boilerplate-web`, `next-saas-boilerplate-admin`) → Settings → Git:

- Connected Git Repository → `johinsDev/next-saas-boilerplate`.
- Production Branch → `main`.
- Ignored Build Step → empty (deploy every push).
- Deploy Hooks → not used today.

When you push to `main`, both Vercel projects build and promote to Production. When you open a PR, both build a Preview deploy and Vercel posts the URLs as a comment on the PR.

---

## 2. The `validate` job (every push, every PR)

`.github/workflows/ci.yml`. Steps:

1. Checkout.
2. Bun pinned to `1.2.10` (matches root `package.json#packageManager`).
3. Cache `.turbo/` keyed by SHA.
4. `bun install --frozen-lockfile` — fails if `bun.lock` drifted.
5. `bun run lint` — `oxlint` via turbo across every package (read-only, no auto-fix).
6. `bun run knip` — dead code, unused deps, unused exports. Config in `knip.json`.
7. `bun run typecheck` — `tsc --noEmit` across every package.
8. `bun run test` — vitest run across every package.

> No `format:check` — with oxlint as the only formatter/linter, `lint` already validates style. `format` (auto-fix) is a local convenience.

If any step fails the PR is blocked from merging. The whole job takes ~3-5 min on a warm cache.

### Placeholder env vars

The validate job sets fake `DATABASE_URL`, `BETTER_AUTH_SECRET` so build-time scripts that read env via `dotenv -e .env --` don't spook out. Real secrets aren't needed for unit tests.

---

## 3. Opening a PR

```bash
git checkout -b feat/<short-name>
# … work …
git commit -m "feat(<scope>): <subject>"
git push -u origin feat/<short-name>

gh pr create --fill-first
# Then edit the description in your editor / on github.com using the
# repo's PR template (.github/PULL_REQUEST_TEMPLATE.md).
```

Required scopes for commit messages live in `commitlint.config.ts` (see the `tooling` skill).

The PR template asks for:

- **Summary** — bullets describing what + why.
- **Linear** — the LOY-XXX ticket.
- **Test plan** — how you verified it.
- **Screenshots** — for UI / PWA changes.
- **Risk & rollback** — blast radius + how to undo.

---

## 4. The `e2e` job (deferred)

In `ci.yml` but gated `if: false`. Will run Playwright once specs exist in `apps/e2e/tests/*`. Reads `WEB_PROD_URL` and `ADMIN_PROD_URL` from repo Variables (set when LOY-43 lands). Until then, leave `if: false`.

---

## 5. Adding a new check to `validate`

1. Create the script (script in a workspace's `package.json` or a top-level `bun run X`).
2. Add a step in `ci.yml` between two existing steps. Naming: imperative, lowercase, e.g. `- name: Format check`.
3. Open a PR with the change. The new step runs on the PR itself — meta-validation.

---

## 6. Troubleshooting

### `bun install --frozen-lockfile` fails

Lockfile drifted. Run `bun install` locally, commit the updated `bun.lock`, push.

### `oxlint`/`tsc` passes locally but fails in CI

99% of the time: caching. Locally you have `.turbo/` warm; CI is cold. Run `bun run clean && bun install && bun run lint typecheck` locally to repro.

### Vercel preview is broken even though `validate` is green

Vercel auto-deploy is independent. Check the Vercel project → Deployments → click the failing one → Build Logs. Common causes:

- Env var missing in Vercel (Settings → Environment Variables).
- Sensitive env var that needed to be Plain Text for build-time access (see `vercel` skill troubleshooting).

### "validate" check doesn't show on the PR

The workflow file may have a syntax error. View Actions → workflow runs; if the workflow itself failed to parse, it shows as "no runs". Run `gh workflow view ci.yml` to confirm.

### PR can be merged without `validate` running

Branch protection isn't enforcing the check. Settings → Branches → ruleset for `main` → "Require status checks" → make sure `validate (lint, knip, typecheck, test)` is in the required list. If you renamed the job, the old check name still appears as required and the new one isn't — re-add.

---

## 7. References

- Workflow: `.github/workflows/ci.yml`
- PR template: `.github/PULL_REQUEST_TEMPLATE.md`
- Code owners: `.github/CODEOWNERS`
- Commit scopes: `commitlint.config.ts` (see the `tooling` skill)
- Knip config: `knip.json`
- Branch protection: GitHub repo Settings → Branches → ruleset for `main`
- Vercel auto-deploy config: Vercel project → Settings → Git
