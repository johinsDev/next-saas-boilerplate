---
name: realtime
description: Real-time WebSocket events for the next-saas-boilerplate monorepo via PartyKit (Cloudflare Workers + Durable Objects). Use when wiring a live event (stamp earned, reward ready, promo announcement, future chatbot), adding a new party, debugging a stuck connection, switching between local PartyKit and the deployed worker, or designing where the next real-time concern belongs.
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

# realtime — PartyKit channel for the next-saas-boilerplate

Push wakes a user when they're offline. Real-time lights up the screen they already have open. Two complementary channels for the same event: when the cashier scans a stamp, push fires a notification on the phone in their pocket AND the PWA the user has open animates the new stamp live.

This skill covers the WebSocket side. The cousin channels (`whatsapp`, `sms`, `email`, `push`) live in their own skills.

---

## When to reach for realtime vs push vs other channels

| Channel | When | User state |
| --- | --- | --- |
| **realtime** | Live in-app update, sub-100ms | Connected (tab / app open) |
| **push** | Wake up the user, OS notification | Offline / background |
| **database notification** (planned) | Inbox / bell-icon history | They'll see it next time they open the app |
| **email / sms / whatsapp** | Out-of-app retention + receipts | Always (when content warrants it) |

A "stamp earned" event ideally fires on realtime AND push (and later database). They're not substitutes — each owns a different window. The future `@saas/notify` orchestrator will fan-out across them automatically; for now call each channel directly from the feature service.

---

## Where things live

| What | Where |
| --- | --- |
| PartyKit deploy target | `partykit/` (own Cloudflare worker, own `partykit.json`) |
| Customer party (implemented) | `partykit/src/parties/customer.ts` |
| Shared auth helpers (party-side) | `partykit/src/parties/_shared/auth.ts` |
| Server-side publisher | `packages/realtime/src/client.ts` (`RealtimeClient`) |
| Server-side ticket signer | `packages/realtime/src/ticket.ts` (`signTicket`, `signHmac`) |
| React hook (browser) | `packages/realtime/src/client/index.ts` (`usePartyRoom`) |
| Fake for tests / dev fallback | `packages/realtime/src/fake.ts` (`FakeRealtime`) |
| tRPC ticket issuance | `packages/api/src/features/realtime/` |
| App bootstraps | `apps/{web,admin}/src/lib/realtime.ts` |
| App tRPC ctx wiring | `apps/{web,admin}/src/lib/trpc/server.ts` + `app/api/trpc/[trpc]/route.ts` |
| Web hook (customer room) | `apps/web/src/features/realtime/hooks/use-customer-room.ts` |
| Connection badge component | `apps/web/src/features/realtime/components/connection-badge.tsx` |
| Dev smoke page | `apps/web/app/[locale]/(dev)/realtime/page.tsx` |
| Stamp-earned listener (consumer) | `apps/web/src/features/card/components/stamp-earned-listener.tsx` |

---

## How a Party works

A **Party** is a class implementing `Party.Server` that backs **a single room** (one Durable Object instance). PartyKit instantiates one Party object per room id, on demand, and hibernates it when no one's connected.

Lifecycle hooks (override what you need):

| Hook | When it runs | Use for |
| --- | --- | --- |
| `onBeforeConnect(request)` | Before the WebSocket handshake | Reject unauthorized connections (return a `Response`) |
| `onConnect(conn)` | Right after the WS opens | Greet the client, send initial state |
| `onMessage(message, conn)` | Each WS frame from the client | Process client-pushed events (chat, presence) |
| `onRequest(req)` | HTTP request to `https://host/parties/<kind>/<room>` | Server-to-party broadcast endpoint |
| `onClose(conn)` | WS closed | Cleanup, presence updates |
| `onError(conn, err)` | WS error | Logging |

State lives in:
- `this.room.id` — the room id you can use as a logical key (`customer:c_xxx`)
- `this.room.connections` — every open WebSocket in this room
- `this.room.storage` — Durable Object key/value, persists across hibernation
- `this.room.env` — env vars pushed via `partykit env push`

Methods you'll call:
- `this.room.broadcast(message)` — send to every connection in the room
- `this.room.broadcast(message, [exceptIds])` — fan-out except specific peers (for presence-style)
- `conn.send(message)` — send to one client

---

## Auth flow (ticket + HMAC)

```
┌──────────────────┐   1. Mount hook                    ┌────────────────────┐
│  apps/web        │ ─────────────────────────────────▶ │ Next API (tRPC)    │
│  React component │ ◀─────── 2. signed JWT ticket ──── │ realtime.issueTicket
│                  │                                     └────────────────────┘
│                  │   3. wss + token query             ┌────────────────────┐
│                  │ ────────────────────────────────▶  │ PartyKit           │
│                  │ ◀────── 4. WS open / events ────── │ Party.onBeforeConnect
└──────────────────┘                                    │   verifyTicket(...)
                                                        └─────────▲──────────┘
┌──────────────────┐                                              │
│  Next service    │   5. realtime.publish(room, event)           │
│  (sellos, etc.)  │ ─── HMAC-signed POST + body ─────────────────┘
└──────────────────┘                                  onRequest → verifyHmac → broadcast
```

**Tickets** — HS256 JWTs with `{ sub: customerId, room: roomId, exp }`. TTL = 5 min. The hook refreshes 30s before expiry.

**HMAC header** — `X-Realtime-Signature: hmac-sha256=<hex>` over the raw request body. Same secret as tickets.

Both use **`REALTIME_AUTH_SECRET`** — MUST be the same value in Vercel (Next side) and pushed to PartyKit (`partykit env push REALTIME_AUTH_SECRET`).

Why this design:
- **Tickets, not cookies** — Better Auth cookies are scoped to the Next host. PartyKit runs on a different origin (`<project>.partykit.dev`) so cookies don't cross. Signing a short-lived ticket sidesteps the whole CORS / cookie / SameSite headache.
- **HMAC for server-to-party** — only callers who hold the shared secret can broadcast. The PartyKit endpoint is public on the internet; the HMAC is what keeps random POSTers out.

To rotate the secret:
1. Generate a new value: `openssl rand -base64 48`
2. Push to PartyKit first: `partykit env push REALTIME_AUTH_SECRET --value <new>`
3. Update Vercel (web + admin) and redeploy. Any in-flight tickets signed with the old secret will be rejected — they last at most 5 minutes.

---

## Publishing an event from Next

```ts
import { realtime } from "@/lib/realtime";   // or read it off ctx in a tRPC procedure

await realtime.publish(`customer:${customer.id}`, {
  event: "stamp.earned",
  data: { totalStamps: 5, remainingForReward: 2 },
});
```

That's it. Inside tRPC procedures, prefer `ctx.realtime` (bound in `apps/<app>/app/api/trpc/[trpc]/route.ts`) so the router doesn't reach for the bootstrap singleton.

Conventions:
- **`event` is dotted**, namespace-first: `stamp.earned`, `reward.ready`, `promo.live`, `chat.message`, `connection.ready`. The namespace = the feature; the verb = past-tense for "this happened" events, imperative for commands.
- **`data` is small** — keep it under a few hundred bytes. Anything heavier should fetch via tRPC after the event fires.
- **Best-effort, never blocks the write** — if the realtime POST fails, swallow the error. Push + database channels will catch the user up. Realtime is the cherry on top.

---

## Subscribing from React

```tsx
import { useCustomerRoom } from "@/features/realtime/hooks/use-customer-room";

function CardLiveBanner({ customerId }: { customerId: string }) {
  const { status, lastEvent } = useCustomerRoom<StampEarnedEvent>({
    customerId,
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST,
    onEvent: (e) => {
      if (e.event === "stamp.earned") {
        // refetch the server-rendered card data, fire a celebration, etc.
      }
    },
  });
  return <ConnectionBadge status={status} />;
}
```

The hook handles:
- Calling `api.realtime.issueTicket` for a fresh JWT
- Opening the WebSocket with `?token=<jwt>`
- Auto-refreshing tickets before expiry
- Reconnect with backoff (`partysocket` under the hood)

`status` transitions: `idle → connecting → open → closed`. Use the existing `<ConnectionBadge />` for dev visibility; in prod you usually don't render anything when realtime fails — fall back to push + the server-rendered state, which is fresh after `router.refresh()`.

---

## Adding a new party

Use this when you have a concern with its own auth rules, its own storage needs, or its own message shape. Don't reach for a new party if you're just adding a new event to an existing one.

1. **Create the file** — `partykit/src/parties/<name>.ts` exporting `default class <Name>Party implements Party.Server`.
2. **Register in `partykit.json`** under `parties`:
   ```jsonc
   "parties": {
     "customer": "src/parties/customer.ts",
     "org": "src/parties/org.ts"    // ← new
   }
   ```
3. **Add the room kind** to `RoomName` in `packages/realtime/src/types.ts` if not already there (`customer:` / `org:` / `chat:` are pre-declared).
4. **Add the auth rule** in `packages/api/src/features/realtime/service.ts` — extend `issueTicket()` to allow this kind for the right callers (staff for `org:`, the customer for `chat:c_<own-id>`, etc.).
5. **Wire publishers** from the right service layer using `realtime.publish("<kind>:<id>", { event, data })`.

The customer party is the canonical template — copy it as a starting point.

---

## Patterns (documented stubs)

### Pattern: `org:<orgId>` broadcast party

For the admin cashier dashboard. One room per organization; staff members see live activity across all customers in their org.

- **Auth rule** (in `issueTicket`): require the caller to be a `member` of `org:<orgId>` (Better Auth's organization plugin already models this). Reject if not staff.
- **Events**: `customer.joined`, `stamp.added.by-cashier`, `reward.redeemed`. Some events here mirror what the customer party publishes but with extra fields the staff needs (cashier name, terminal id).
- **Storage**: probably none for v1 — just broadcast. Add `room.storage` later for a "live feed" replay buffer.

### Pattern: `chat:<customerId>` chatbot party

A future per-customer chat with the brand. The party class becomes a stateful server, not just a relay:

```ts
export default class ChatParty implements Party.Server {
  async onMessage(message: string, conn: Party.Connection) {
    const history = (await this.room.storage.get<Msg[]>("history")) ?? [];
    const userMsg = JSON.parse(message) as Msg;
    history.push(userMsg);

    // Stream the LLM response
    const stream = await callClaudeStream(history);
    let acc = "";
    for await (const chunk of stream) {
      acc += chunk.text;
      this.room.broadcast(JSON.stringify({ event: "chat.delta", data: { text: chunk.text } }));
    }
    history.push({ role: "assistant", content: acc });
    await this.room.storage.put("history", history);
  }
}
```

Why a separate party (vs reusing the customer one):
- Different lifetimes — chat conversations persist; customer events are fire-and-forget
- Different auth — chat sessions might need per-conversation tokens to share with support staff
- Different storage — chat needs Durable Object key/value; the customer party doesn't write anything

Open questions when we go to build it:
- Conversation history retention (TTL via `room.storage.setAlarm`)
- Multi-device sync — already free because each device joins the same room
- Handoff to human support — agent joins via a different ticket kind

---

## Testing

`FakeRealtime` is a drop-in for `RealtimeClient`:

```ts
import { FakeRealtime } from "@saas/realtime";

it("publishes stamp.earned when a sello is added", async () => {
  const fake = new FakeRealtime();
  const caller = appRouter.createCaller({
    ...ctxBase,
    realtime: fake,
  });
  await caller.sellos.add({ cardId: "...", amount: 1 });
  fake.assertPublished("customer:c_123", (e) => e.event === "stamp.earned");
});
```

Assertions: `assertPublished(room, predicate?)`, `assertPublishedCount(n)`, `assertNonePublished()`, `clear()`.

---

## Local dev

```bash
# Terminal 1: PartyKit dev server
bun --cwd partykit run dev
# → http://127.0.0.1:1999

# Terminal 2: apps/web with the local partykit host
NEXT_PUBLIC_PARTYKIT_HOST=127.0.0.1:1999 \
  PARTYKIT_HOST=127.0.0.1:1999 \
  PARTYKIT_PROJECT=next-saas-boilerplate-realtime \
  REALTIME_AUTH_SECRET=dev-secret-min-32-chars-pad-pad-pad-pad \
  bun run dev
```

Then visit `http://localhost:3002/es/realtime` (the dev smoke page). The hook should detect `127.0.0.1` and use `ws://` automatically.

When PartyKit isn't running locally, the app falls back to `FakeRealtime` — `realtime.publish` becomes a no-op log line instead of a network call. The UI just shows "offline" in the connection badge.

---

## Deploy (cloud-prem on Cloudflare)

We deploy the party to **our own Cloudflare account** (cloud-prem), not PartyKit
cloud. Domain `t4diverclub.app` is on Cloudflare. Hosts:

| Env | Party host |
| --- | --- |
| staging (all previews share it) | `partykit-staging.t4diverclub.app` |
| prod (Fase 4) | `partykit.t4diverclub.app` |

> **Requires Cloudflare Workers Paid (~$5/mo).** PartyKit creates KV-backed
> Durable Objects (`new_classes`); the **free plan rejects** them
> (`Error: ... Durable Objects with a free plan ... must create a namespace
> using a new_sqlite_classes migration`). PartyKit (≤0.0.115) doesn't emit
> SQLite DOs, so the paid plan is the unblock. Enable at
> `dash.cloudflare.com/<account-id>/workers/plans`.

```bash
# Deploy creds (CF API token "Edit Workers" template — Account: Workers
# Scripts Edit; Zone t4diverclub.app: Workers Routes Edit + DNS Edit + Zone Read).
# Stored in Infisical prod /ci as CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
#
# The shared secret is injected at deploy with --var (cloud-prem). NOTE:
# `partykit env push` targets PartyKit cloud, NOT a cloud-prem deploy — use --var.
cd partykit
CLOUDFLARE_ACCOUNT_ID=<id> CLOUDFLARE_API_TOKEN=<token> \
  bunx partykit deploy --domain partykit-staging.t4diverclub.app \
    --var REALTIME_AUTH_SECRET="<the-secret>"

# Domain provisioning takes up to ~2 min. Verify (root is 404 — hit a party):
curl -s https://partykit-staging.t4diverclub.app/party/main
# → {"ok":true,"project":"next-saas-boilerplate-realtime","time":"..."}
```

Then the Next side reads these from **Infisical staging `/shared`** (synced to
the Vercel Preview env), which is what flips previews off `FakeRealtime`:

```
PARTYKIT_HOST=partykit-staging.t4diverclub.app
NEXT_PUBLIC_PARTYKIT_HOST=partykit-staging.t4diverclub.app
PARTYKIT_PROJECT=next-saas-boilerplate-realtime
REALTIME_AUTH_SECRET=<same secret passed to --var>
```

(For local dev, the same four live in Infisical `dev`; prod gets its own party +
secret in Fase 4.)

### Preview isolation (per-PR room prefix)

All previews share the one staging party, so rooms are namespaced per PR via
**`REALTIME_ROOM_PREFIX`** (pinned to `pr-<n>-` by `.github/workflows/preview.yml`,
empty in prod/local). It's applied **server-side only** — the ticket service +
`RealtimeClient` prefix the room *body* (`customer:<id>` → `customer:pr-7-<id>`),
and the React hook connects to whatever `ticket.roomId` grants. The party is
unchanged. Cleanup removes the branch-scoped var when the PR closes; the party
is shared so there's nothing to tear down.

---

## Common pitfalls

- **TTL drift**: the JWT `exp` is checked server-side by `jwtVerify`. If your laptop's clock is wrong, you'll see "invalid token" rejections even with a fresh ticket. Sync NTP.
- **Secret mismatch**: the worker rejects with 401 and there's no body explaining why (intentional — don't leak details). If you suspect, log a one-off `console.log` in `onBeforeConnect` to compare token signatures locally.
- **`ws://` vs `wss://`**: `partysocket` defaults to wss. Local PartyKit serves ws. The `useCustomerRoom` hook detects `127.0.0.1` / `localhost` and switches automatically; manual `usePartyRoom` callers must pass `protocol: "ws"` for local.
- **Browsers buffer WebSocket frames**: if you're not seeing your event, open DevTools → Network → WS tab and look at the frame stream. The hook also re-fires `connection.ready` on every reconnect — useful as a heartbeat.
- **Room id leak**: a JWT scoped to `customer:c_123` cannot connect to `customer:c_456` — `onBeforeConnect` checks. But if you accidentally issue a ticket for the wrong room from a buggy `issueTicket()`, the party will accept it. Always derive `roomId` server-side from the caller's identity, never from arbitrary input.
- **PartyKit hibernation**: rooms with no connections sleep after ~30s. A POST to a sleeping room wakes it but adds ~200ms cold-start latency. Acceptable for first event; reconnections stay warm.
