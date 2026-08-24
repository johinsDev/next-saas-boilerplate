---
name: push
description: Send push notifications from the next-saas-boilerplate monorepo via `@saas/push`. Unified abstraction over Web Push (PWA browsers via VAPID + Service Worker) and Expo Push (future native app). Use when triggering a send (stamp earned, reward ready, redemption confirmed), registering a device token, adding a new transport, switching provider per environment, debugging delivery, asserting sends in tests, or reviewing the `push_outbox`.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# @saas/push — provider-agnostic push notifications

`@saas/push` is the fifth strategy package after `@saas/whatsapp`, `@saas/sms`, `@saas/email` and the `@saas/cache` cousin. Same Manager / Sender / FakeSender shape, same dev outbox view + admin panel + prune cron.

What's different: **two production protocols share the same abstraction.** Browser PWAs use Web Push (VAPID + Service Worker Push API); the future native app will use Expo Push. The `auto` sender fans out a single send across both transports based on each stored token's `platform`.

---

## Where things live

| What | Where |
| --- | --- |
| Sending package | `packages/push/src/` |
| Public API | `packages/push/src/index.ts` |
| Transports | `packages/push/src/transports/{webpush,expo,log,outbox}.ts` |
| `BasePush` (typed messages) | `packages/push/src/base-push.ts` |
| `PushMessage` (fluent builder) | `packages/push/src/push-message.ts` |
| `FakeSender` | `packages/push/src/fake-sender.ts` |
| `PushManager` + `AutoPushSender` | `packages/push/src/manager.ts` + `sender.ts` |
| Unit tests | `packages/push/src/__tests__/` |
| `push_outbox` Drizzle table | `packages/db/src/schema/push-outbox.ts` |
| `push_token` Drizzle table | `packages/db/src/schema/push-tokens.ts` |
| Hono RPC outbox feature | `packages/api/src/features/push-outbox/` |
| Hono RPC tokens feature | `packages/api/src/features/push-tokens/` |
| Web bootstrap | `apps/web/src/lib/push.ts` |
| Admin bootstrap | `apps/admin/src/lib/push.ts` |
| Web dev view | `apps/web/app/[locale]/(dev)/push-outbox/` |
| Admin panel | `apps/admin/app/[locale]/(dashboard)/push-outbox/` |
| E2E endpoint | `apps/web/app/api/push-outbox/{route.ts, [id]/route.ts}` |
| Service Worker handler | `apps/web/app/sw.ts` (push + notificationclick listeners) |
| Browser subscription helper | `apps/web/src/lib/push-subscription.ts` |
| Subscription hook + button | `apps/web/src/features/push/` |

---

## Web Push vs Expo Push — what's actually different

| Aspect | Web Push (PWA) | Expo Push (native) |
| --- | --- | --- |
| Client API | `navigator.serviceWorker.pushManager.subscribe(...)` → `PushSubscription` JSON | `Notifications.getExpoPushTokenAsync()` → `ExponentPushToken[…]` |
| Server protocol | `web-push` lib → push service endpoint (FCM/Mozilla), VAPID-authed | `expo-server-sdk` → `https://exp.host/--/api/v2/push/send` |
| Auth | VAPID public + private + subject (mailto:) | Optional `EXPO_ACCESS_TOKEN` |
| Rendering | Service Worker calls `registration.showNotification(...)` | Expo / OS renders directly |
| Expiry signal | HTTP 410 Gone | Ticket `details.error: "DeviceNotRegistered"` |

The abstraction hides all of this — your code calls `push.send((m) => m.toUser(id).title(...).body(...))` and the right transport fires. The platform discriminator is on the stored token, not on the call site.

---

## Send a push

### Inline callback (one-off, no class)

```ts
import { push } from "@/lib/push";

await push.send((m) => {
  m.toUser(customer.id)
    .title("¡Sumaste un sello!")
    .body("Te falta 1 para tu próximo bubble tea")
    .data({ deepLink: "/card" })
    .clickAction("/card");
});
```

### Class style (preferred for reused notifications)

```ts
import { BasePush } from "@saas/push";

export class StampEarnedPush extends BasePush {
  constructor(
    private readonly customerId: string,
    private readonly stampsRemaining: number,
  ) {
    super();
  }

  prepare(): void {
    this.message
      .toUser(this.customerId)
      .title("¡Sumaste un sello!")
      .body(
        this.stampsRemaining === 1
          ? "Te falta 1 para tu próximo bubble tea"
          : `Te faltan ${this.stampsRemaining} para tu próximo bubble tea`,
      )
      .clickAction("/card");
  }
}

// callsite:
await push.send(new StampEarnedPush(customer.id, 1));
```

`BasePush.shouldSend()` gates the send for queue handlers — return false to skip (DND, marketing prefs, A/B test).

---

## Provider selection

`apps/{web,admin}/src/lib/push.ts` picks the default based on the runtime:

| Where | Provider | Notes |
| --- | --- | --- |
| Local dev | `log` | One structured line via `@saas/log`, no network |
| Vercel preview | `outbox` | Rows in `push_outbox`, viewable in `(dev)/push-outbox` |
| Vercel production | `auto` | Per-recipient fan-out: webpush for browser tokens, expo for native tokens |

Override with `PUSH_PROVIDER=log|outbox|webpush|expo|auto` in `.env`. The `auto` provider degrades gracefully — when VAPID keys are missing, it's not registered, so falling back to `outbox` is safe.

### Required env per provider

| Provider | Env vars | Generated by |
| --- | --- | --- |
| `webpush` / `auto` | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:) | `bunx web-push generate-vapid-keys` |
| `webpush` (client) | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Mirror of `VAPID_PUBLIC_KEY` — exposed so the browser can subscribe |
| `expo` / `auto` | `EXPO_ACCESS_TOKEN` (optional) | Expo dashboard → Access tokens |

The `tokenLookup` scopes tokens by `(customerId, orgId)`; the org id is resolved from the DB via `getPrimaryOrganizationId()` (`@saas/db`) — the first/principal organization — so no `the app_ORG_ID` env is needed.

Validated by `apps/{web,admin}/src/env.ts` via `@t3-oss/env-nextjs`. Boot fails if VAPID is missing when `webpush` or `auto` is selected.

---

## Token registration

Tokens flow `client → Hono RPC → push_token` so each device is registered before it can receive sends.

### Browser (PWA)

The `usePushSubscription` hook in `apps/web/src/features/push/hooks/use-push-subscription.ts` wraps:

1. `Notification.requestPermission()` — MUST be called from a user gesture.
2. `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
3. `api.pushTokens.register({ platform: "webpush", token: JSON.stringify(sub), deviceLabel: navigator.userAgent })`

Drop `<PushEnableButton customerId organizationId vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />` somewhere in the onboarding flow (placement TBD).

### Native (Expo, future)

In the Expo app:

```ts
const { data: token } = await Notifications.getExpoPushTokenAsync();
await api.pushTokens.register({
  customerId,
  organizationId,
  platform: "expo",
  token,
  deviceLabel: Device.modelName,
});
```

### Server-side deactivation

When the `auto` sender catches a `SubscriptionExpiredError`, it returns `status: "expired"` for that response. Caller is responsible for calling `pushTokenRepository.deactivateByToken(token)` to mark the row inactive (queue handler / hook — out of scope for v1, tracked in Linear).

---

## Service Worker handlers

`apps/web/app/sw.ts` wires two listeners alongside serwist's existing setup:

- `push` event → parses payload JSON + calls `registration.showNotification(...)` with title, body, icon, image, badge, and `data: { clickAction, ...payload.data }`.
- `notificationclick` event → focuses an existing client tab (and navigates it to `clickAction` if supported) or opens a new window.

The payload shape is whatever `WebPushTransport` sends. If you change one, change the other.

---

## Testing

```ts
import { push } from "@/lib/push";
import { StampEarnedPush } from "@/features/next-saas-boilerplate/push/stamp-earned";

beforeEach(() => push.fake());
afterEach(() => push.restore());

it("notifies the customer when they earn a stamp", async () => {
  const fake = push.fake();
  await runStampFlow({ customerId: "c_123", stampsRemaining: 2 });
  fake.assertSent(StampEarnedPush, (p) =>
    p.message.toData().recipients.some(
      (r) => r.kind === "user" && r.userId === "c_123",
    ),
  );
});
```

`FakeSender` exposes `sent` (instances) + `sentMessages` (compiled `PushMessageData`). Assertions: `assertSent`, `assertNotSent`, `assertSentCount`, `assertNoneSent`, `assertSentTo(token|userId)`, `clear`.

---

## Adding a new transport

Five steps, same as cache / sms / email:

1. Implement `PushTransport` in `packages/push/src/transports/<name>.ts`.
2. Add the config variant to `ProviderConfig` (`types.ts`).
3. Wire into `#buildSender()` in `manager.ts`.
4. Add a UT under `__tests__/transports/<name>.test.ts`.
5. Reference it from the bootstrap in `apps/{web,admin}/src/lib/push.ts`. Bump `peerDependencies` + `knip.json.packages/push.ignoreDependencies` if the SDK is optional.

---

## Dev view at `/push-outbox`

URL: `http://localhost:3002/es/push-outbox` (or `/en/`). Same `isDevOnlyEnabled()` gate as the other outbox views — returns 404 in production. The detail page shows the visible push (title + body) plus the JSON of `data` and `metadata` (badge, icon, image, clickAction, ttl, priority, sound) — no iframe needed since push payloads aren't HTML.

Filters via nuqs: `deviceToken` partial match (ILIKE), search over title, platform pills (webpush / expo), status pills.

---

## API surface

### Outbox

```ts
api.pushOutbox.list({ deviceToken?, platform?, status?, search?, page, pageSize });
api.pushOutbox.get({ id });
api.pushOutbox.latestForRecipient({ deviceToken, limit });
```

`a public route` — gated by env at the page + endpoint layer, not by auth.

### Tokens

```ts
api.pushTokens.register({ customerId, organizationId, platform, token, deviceLabel? });
api.pushTokens.list({ customerId, organizationId });
api.pushTokens.revoke({ customerId, organizationId, token });
api.pushTokens.listForLookup({ customerId, organizationId }); // server-side helper for the auto sender
```

`an authenticated route` — auth required. Future hardening: scope `customerId` by session/active-org (matches the stub `clientes` router's TODO).

---

## Outbox retention

The `push_outbox` table is pruned daily by the `prune-outboxes` Trigger.dev task in `packages/jobs/trigger/prune-outboxes.ts` — rows older than `OUTBOX_RETENTION_DAYS` (default 30) get deleted at 04:00 UTC alongside `email_outbox`, `sms_outbox`, and `whatsapp_outbox`.

Push rows are the lightest of the four (just title + body + a small JSON payload), but retention still matters for local dev + preview deploys. Bump `OUTBOX_RETENTION_DAYS=90` in the Trigger.dev project env to keep more history; pause the task in the dashboard to disable cleanup entirely. The task calls `PushOutboxService.prune()` → `PushOutboxRepository.deleteOlderThan()` — same layering as every other DB op in this feature.

---

## Common pitfalls

- **`Notification.requestPermission` requires a user gesture.** Calling it on mount silently fails. Mount the prompt behind a button click.
- **Web Push has a ~4KB payload limit.** Browsers reject larger payloads; keep title + body short and put long-form content behind `clickAction`.
- **Expo tokens expire on uninstall / reinstall.** The new install gets a new token; the old one starts returning `DeviceNotRegistered`. The auto sender surfaces these as `status: "expired"` for cleanup.
- **VAPID keys are env-specific.** Generate a separate pair for prod vs preview if you want to test independently — sharing keys means a revoked subscription in one env kills it in the other.
- **`token` for webpush is a JSON-stringified `PushSubscription`** — not a single ID. The `push_token.token` column stores the full string; deduping happens by string equality via the unique index `(customer_id, organization_id, token)`.
- **The web dev server disables the service worker** so HMR works. To exercise push delivery locally, run `bun --cwd apps/web run build && bun --cwd apps/web run start` or test against a preview deploy.

---

## Realtime is the complement, not a substitute

Push wakes a user who's offline; **realtime** lights up the screen they already have open. A single "stamp earned" event ideally fires on both: realtime so the next-saas-boilerplate card animates while the user looks at it, push so the phone in the pocket also buzzes. See `.claude/skills/realtime/SKILL.md` for the PartyKit channel and how to publish events that match the push payloads.

---

## Why Expo for native + VAPID for web

Both are managed protocols on top of FCM/APNs:

- **Expo Push** handles APNs certificate management + FCM Server Keys + topic broadcasting for us. Going direct to FCM/APNs means juggling two SDKs, two auth flows, and writing the fan-out by hand. Expo is the path of least operations until we have a real reason to ditch it.
- **Web Push (VAPID)** is the only push protocol supported by browsers. There's no alternative — every browser PushManager subscription speaks this protocol with a service-issued endpoint (FCM for Chrome/Edge, Mozilla for Firefox, etc).

Switching Expo → raw FCM later is mechanical: add an `FcmTransport`, plumb the config, swap the provider in `auto` — the abstraction was built for it.
