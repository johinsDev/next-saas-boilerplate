# Working in this repo

## Read first

- **`.claude/skills/architecture-guard`** — where data access lives. It is the authority
  and it overrides any skill that disagrees.
- **`.claude/skills/features`** — how a feature is laid out.
- **[ROADMAP.md](./ROADMAP.md)** — what is deliberately missing. Check it before building
  something that is already planned in a particular shape.

## Non-negotiables

- **English throughout.** Code, comments, commits, docs. User-facing copy is bilingual
  data, never English source with translations bolted on.
- **TDD.** Write the test, watch it fail, then write the code. Verify by mutation: break
  the code the way the bug would and watch the specific test fail.
- **No tRPC.** The typed API is Hono RPC (`hc<AppType>`, types only). Web and admin do
  not go through it at all.
- **Services raise `ServiceError`, never a transport error.** See
  `packages/services/src/features/_shared/errors.ts`.
- **A new provider integration is an adapter behind the existing port**, with a fake, not
  a new package.

## Commands

```bash
bun install
bun run typecheck / test / lint / build
```

Commits are conventional; scopes live in `commitlint.config.ts`.

## Porting more from the source application

Most packages came across with a scope rename. The service layer did not: it was written
against tRPC context and a domain schema. When lifting another slice, expect to rewrite
its error handling and its notion of who the actor is, not just its imports.
