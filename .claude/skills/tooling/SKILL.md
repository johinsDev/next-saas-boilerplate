---
name: tooling
description: Lint / format / commit conventions for the next-saas-boilerplate monorepo (oxlint + Oxformat + commitlint + lefthook). Use when adding rules, debugging a blocked commit, allowing a new commit scope, or onboarding a teammate to "why did the pre-commit hook reject me".
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

# Tooling — lint, format, commit hooks

The repo uses three tools in sequence to keep the codebase clean. Lefthook orchestrates them as git hooks so they always run before commits land.

```
   ┌─────────────────────────────────────────────────────────────┐
   │                    pre-commit (lefthook)                     │
   │                                                              │
   │   lint  (oxlint)                                            │
   │   ↓ on staged TS/TSX/JS files                               │
   │                                                              │
   │   format  (oxlint --fix style / Oxformat)                   │
   │   ↓ on staged files                                         │
   │                                                              │
   │   typecheck  (turbo run typecheck → tsc --noEmit)           │
   │   ↓ across every package                                    │
   └─────────────────────────────────────────────────────────────┘
                              ↓
   ┌─────────────────────────────────────────────────────────────┐
   │                    commit-msg (lefthook)                     │
   │                                                              │
   │   commitlint                                                │
   │   ↓ enforces Conventional Commits + scope-enum               │
   └─────────────────────────────────────────────────────────────┘
```

---

## 1. oxlint — the linter

[oxlint](https://oxc-project.github.io/) is a Rust-based JS/TS linter. It's much faster than ESLint and the rules cover ~90% of what you'd want.

### Where rules live

- **Root config**: `packages/tooling/oxlint/.oxlintrc.json` — enabled categories, env, ignored paths, top-level rule overrides.
- **Per-package config**: most packages don't need one; they inherit from the root because oxlint walks up looking for the closest `.oxlintrc.json`. If a package needs an override, drop a `.oxlintrc.json` in that package and add only the diffs.

### Categories enabled

```jsonc
{
  "categories": {
    "correctness": "error",   // bugs (e.g. unused-await)
    "suspicious": "error",    // probable bugs (e.g. eqeqeq)
    "perf": "warn",           // performance smells
    "style": "off",           // pure style (Oxformat handles most of it)
    "pedantic": "off",
    "nursery": "off",
    "restriction": "off"
  }
}
```

If a rule is too noisy for a specific file, disable it inline:

```ts
// oxlint-disable-next-line no-console
console.log("intentional");
```

### Running it

| Command | What |
| --- | --- |
| `bun run lint` | Runs `turbo run lint` → each package's `lint` script (`oxlint <src dirs>`). |
| `bun run lint:fix` | Same with `--fix`. |
| `oxlint <path>` (in a package) | Lints a single path. |

### Recommended VSCode extension

`oxc.oxc-vscode` — surfaces lint errors inline. Format-on-save is configured by the repo's `.vscode/extensions.json` (only `extensions.json` is versioned; everything else under `.vscode/` is gitignored).

---

## 2. Oxformat — the formatter

Oxformat is the formatter side of the oxc toolchain, invoked via `oxlint --fix` for the style rules it owns.

### Where it runs

- Pre-commit hook applies it automatically to staged files.
- Manually: `bun run format` (inside any package) → `oxlint <dirs> --fix`.

There is no Prettier and no `.prettierrc`. **Don't add Prettier** — it would conflict with Oxformat.

### Conventions

- 2-space indent, double quotes, trailing commas where allowed, semi at end of statements.
- Import groups: external first, then `@saas/*`, then relative (oxlint may auto-sort).
- No comment ordering beyond what Oxformat enforces.

---

## 3. commitlint — commit message format

Enforces Conventional Commits with a constrained scope list. Config: `commitlint.config.ts` at the repo root.

### Format

```
<type>(<scope>): <subject>

<body>
```

- `<type>` examples: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`. Anything in `@commitlint/config-conventional`.
- `<scope>` is constrained to the project areas (see below).
- `<subject>` lowercased, no trailing period, present tense ("add X" not "added X").

### Allowed scopes (current list)

| Scope | Use for |
| --- | --- |
| `admin` | apps/admin |
| `web` | apps/web |
| `api` | packages/api (tRPC) |
| `auth` | packages/auth (Better Auth) |
| `db` | packages/db (Drizzle) |
| `jobs` | packages/jobs (Trigger.dev) |
| `log` | packages/log (logger) |
| `ui` | packages/ui |
| `tooling` | anything under packages/tooling/* (vitest-config, tsconfig, oxlint, oxformat) |
| `ci` | GitHub Actions, lefthook hooks themselves |
| `deps` | dependency bumps that don't change behavior |
| `repo` | root config (.gitignore, README, top-level files) |

If you need a new scope, edit `commitlint.config.ts`'s `scope-enum` rule and bump it in the same commit.

### Examples

```
feat(log): add Logger.use(channel) for runtime channel switching
fix(tooling): correct Better Stack MCP URL
chore(repo): gitignore skills cache
docs(log): add better-stack skill
```

### Multi-line bodies

`commitlint` doesn't enforce body line length, but keep them around 72 chars for git log readability. Wrap explanations as paragraphs, separated by blank lines.

### Co-author trailer

Every Claude-assisted commit ends with:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Use a heredoc to make sure the multi-line body lands intact:

```bash
git commit -m "$(cat <<'EOF'
feat(log): add Logger.use(channel)

(body...)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 4. lefthook — the orchestrator

`lefthook.yml` declares which hooks run when. It's installed automatically by the root `prepare` script (`lefthook install`), which the `bun install` lifecycle triggers.

### Hooks enabled

| Hook | Steps | Skip rules |
| --- | --- | --- |
| `pre-commit` | `lint` (staged TS/TSX), `format` (same), `typecheck` (whole repo via turbo) | `lint` and `format` skip if no matching files staged. `typecheck` skips if no `.ts` / `.tsx` staged. |
| `commit-msg` | `commitlint` reads the message at `$1` | always runs |

### When a hook blocks you

- Read the actual error first. Lefthook prints the offending tool's output.
- **Lint failure**: fix the rule violation or, if it's a rule you disagree with, propose a config change in a separate `chore(tooling)` commit.
- **Format failure**: probably a formatting drift the tool can fix automatically — `bun run lint:fix` (or `bun run format`) and re-stage.
- **Typecheck failure**: `bun run typecheck` to see the exact `tsc` diagnostic. Hook reports tsc's exit code without truncating, so the diagnostic is in the buffer.
- **Commitlint failure**: re-edit the message — `git commit --amend` after fixing if you already committed.

**Never bypass with `--no-verify`** unless the user explicitly asks. Even one-off bypass risks shipping broken code; the project's CLAUDE.md prohibits it.

### Disabling lefthook for a specific run (rare)

```bash
LEFTHOOK=0 git commit -m "..."
```

Use only for true emergencies (e.g. lefthook itself broken). Document why in the commit body.

---

## 5. Package-level scripts

Every internal package exposes the same script surface so tooling is uniform:

```jsonc
{
  "scripts": {
    "lint": "oxlint <src-dirs>",
    "format": "oxlint <src-dirs> --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",          // packages with tests only
    "test:watch": "vitest",        // ditto
    "test:coverage": "vitest run --coverage",
    "clean": "rm -rf .turbo node_modules"
  }
}
```

Apps (`apps/web`, `apps/admin`) wrap their `dev`/`build`/`start` with `dotenv -e ../../.env` so env vars from the repo `.env` reach Next.

---

## 6. Adding a new package

When you create `packages/<name>` from scratch:

1. `package.json` with the script surface above.
2. `tsconfig.json` extending `@saas/tsconfig/base.json`.
3. If it has tests, depend on `@saas/vitest-config` and create `vitest.config.ts`:
   ```ts
   import { baseConfig } from "@saas/vitest-config";
   import { defineConfig } from "vitest/config";
   export default defineConfig(baseConfig());
   ```
4. Lefthook + oxlint + commitlint will pick it up automatically.
5. If you need a new commit scope (e.g. `cache`, `notifications`), add it to `commitlint.config.ts`.

---

## 7. Troubleshooting

### "scope must be one of [...]"

You used a scope not in the allow-list. Either pick an allowed one or add yours to `commitlint.config.ts`'s `scope-enum`.

### lefthook never runs

`bun install` should run `lefthook install` via the root `prepare` script. If you cloned and hooks aren't firing:

```bash
bun install
# or
bunx lefthook install
```

Confirm `.git/hooks/pre-commit` exists and references lefthook.

### oxlint: rule not found

You enabled a category that includes a rule oxlint doesn't ship yet. Update oxlint:

```bash
bun add -D oxlint@latest
```

### typecheck slow

Turbo caches per-package. After a `bun install` the cache invalidates; the second run is sub-second. If it's slow consistently, your machine may not be writing to `.turbo/` (ENOSPC, perms).

### commitlint reads a stale config

Restart your shell after editing `commitlint.config.ts` — lefthook spawns a fresh process per commit so this is rare, but VSCode terminals occasionally cache.

---

## Where to look first

- `.oxlintrc.json` (or `packages/tooling/oxlint/.oxlintrc.json`) — lint rules.
- `commitlint.config.ts` — commit message rules.
- `lefthook.yml` — which hooks run when.
- This skill for the "why" behind each piece.
