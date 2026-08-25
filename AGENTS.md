# Working in this repo

## Read first

- **`.claude/skills/architecture-guard`** — where data access lives. It is the authority
  and it overrides any skill that disagrees.
- **`.claude/skills/nextjs-app-architecture`** — how a Next 16 screen is built: synchronous
  pages, `use cache`, Suspense placement, prefetch tiers. Vendored (MIT); read the
  amendment in `architecture-guard`, which says where we differ.
- **`.claude/skills/features`** — how a feature is laid out.
- **`.claude/skills/crud-screens`** — how a list screen and a detail screen are built:
  routes, URL state, what is cached and what deliberately is not, the SQL invariants that
  only break past the first page, table-above-`md`/cards-below, row actions and toasts.
  Read it before adding any admin list — it is there so none of this has to be explained
  again per screen.
- **[ROADMAP.md](./ROADMAP.md)** — what is deliberately missing. Check it before building
  something that is already planned in a particular shape.

## Non-negotiables

- **English throughout.** Code, comments, commits, docs. User-facing copy is bilingual
  data, never English source with translations bolted on.
- **TDD.** Write the test, watch it fail, then write the code. Verify by mutation: break
  the code the way the bug would and watch the specific test fail.
- **The contract is a type-only import.** `hc<AppType>` hands the client the contract at
  compile time and ships nothing at runtime. Never adopt an RPC layer that ships a runtime
  client — on a React Native bundle that cost is the whole decision. Web and admin do not
  cross the network at all.
- **Services raise `ServiceError`, never a transport error.** See
  `packages/services/src/features/_shared/errors.ts`.
- **A new provider integration is an adapter behind the existing port**, with a fake, not
  a new package.

## Next.js: read the docs we actually run

**Next 16 ships version-matched documentation inside `node_modules/next/dist/docs/`**
(`01-app`, `02-pages`, `03-architecture`). That is the authority — over training data, over
blog posts, and over any example repo, several of which run preview builds carrying APIs
that never shipped.

```bash
ls node_modules/next/dist/docs/01-app/03-api-reference/01-directives/    # use-cache*, ...
grep -rl partialPrefetching node_modules/next/dist/docs/
```

Why it matters concretely: the `next-beats` reference app sets
`export const prefetch = 'allow-runtime'` on every page. That value **does not exist** in
the 16.3 we run — the shipped set is `'auto' | 'partial' | 'force-disabled'`. The bundled
docs say so; the repo does not.

`next dev` writes and maintains its own block in each app's `AGENTS.md` pointing at those
docs. Leave it in place and commit it.

## Commands

```bash
bun install
bun run typecheck / test / lint / build
```

Commits are conventional; scopes live in `commitlint.config.ts`.

## Porting more from the source application

Most packages came across with a scope rename. The service layer did not: it was written
against a different transport's request context and a domain schema. When lifting another
slice, expect to rewrite its error handling and its notion of who the actor is, not just
its imports.
