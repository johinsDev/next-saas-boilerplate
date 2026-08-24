# @saas/partykit-server

PartyKit deploy target for the next-saas-boilerplate real-time channel. Standalone Cloudflare project — not a Next route, not an npm package, just a Worker.

See `.claude/skills/realtime/SKILL.md` for the full handbook (parties, auth, deploy, patterns).

## Quick reference

```bash
bun --cwd partykit run dev          # local server on http://127.0.0.1:1999
bun --cwd partykit run deploy       # ship to Cloudflare via partykit.dev
bun --cwd partykit run typecheck    # tsc --noEmit
```

## Env (production)

Pushed to PartyKit via the CLI (NOT via `.env` — Workers don't read dotenv at runtime):

```bash
partykit env push REALTIME_AUTH_SECRET --value "$REALTIME_AUTH_SECRET"
```

`REALTIME_AUTH_SECRET` MUST match the value in Vercel for `apps/web` and `apps/admin` — Next signs tickets + HMAC headers with it; this server verifies them.

## Adding a party

1. Drop a file in `src/parties/<name>.ts` exporting `default class <Name>Party implements Party.Server`.
2. Add it to `parties` in `partykit.json`.
3. Add the room kind to the `RoomName` union in `@saas/realtime`.
4. Add a `verifyXxxAccess()` rule in `packages/api/src/features/realtime/service.ts` so tickets only get issued for rooms the caller can actually join.
