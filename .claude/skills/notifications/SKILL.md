---
name: notifications
description: Multi-channel notifications for the next-saas-boilerplate monorepo — `@saas/notifications`, a class-based engine (à la Laravel/Adonis) that fans one `Notification` out to email / sms / push / whatsapp / realtime / database, respecting per-customer marketing opt-outs, and runs through Trigger.dev. Use when adding a new notification type, adding a channel, wiring the admin "send" screen or the profile preferences toggle, debugging "channel didn't send", or onboarding a teammate to "how does one event reach many channels".
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

# @saas/notifications

One layer above the transport packages (`@saas/email`, `/sms`, `/push`, `/whatsapp`, `/realtime`). Those each send on one medium; this orchestrates: a single `Notification` class declares **which** channels to use (`via()`) and **how** to render each (`toMail()`, `toSms()`, …), and the `Notifier` fans out — resolving the recipient, filtering channels by the customer's marketing preferences, and isolating per-channel failures.

It has **no hard dependency** on the transport packages: channels receive the managers via dependency injection (structural gateway interfaces), so the package drags in no SDKs. The concrete wiring lives in `packages/jobs/notifications.ts`.

## Where things live

| What | Where |
| --- | --- |
| Package source | `packages/notifications/src/` |
| `Notification` base class + `NotificationRenderers` | `packages/notifications/src/notification.ts` |
| `Notifier` (orchestrator) | `packages/notifications/src/notifier.ts` |
| Channel adapters (mail/sms/push/whatsapp/realtime/database) | `packages/notifications/src/channels/*.ts` |
| Per-channel contracts + `BaseChannelMessage` | `packages/notifications/src/messages/*.ts` |
| Preferences engine (`resolveChannels`) | `packages/notifications/src/preferences.ts` |
| `FakeNotifier` (tests) | `packages/notifications/src/fake-notifier.ts` |
| DB tables (`notification`, `notification_preference`) | `packages/db/src/schema/notifications.ts` |
| Drizzle repos (notifiable / preferences / feed) | `packages/api/src/features/notifications/` |
| tRPC router (feed, prefs, customer list, send) | `packages/api/src/features/notifications/router.ts` |
| Notifier bootstrap (DI wiring) | `packages/jobs/notifications.ts` |
| Notification registry + demo classes | `packages/jobs/notifications-registry.ts` |
| Trigger.dev task | `packages/jobs/trigger/send-notification.ts` |
| Admin "send" screen | `apps/admin/src/features/notifications/` |
| Profile preferences toggle | `apps/web/src/features/profile/components/notification-preferences.tsx` |

## Authoring a notification

Subclass `Notification`, set a `category`, declare `via()`, implement the `toX()` renderers you need. Add `implements NotificationRenderers` so the return shapes are type-checked.

```ts
import {
  BaseChannelMessage,
  Notification,
  type NotificationRenderers,
  type SmsContract,
} from "@saas/notifications";

// A toX() may return a plain contract OR a class instance (requirement: toSms() → new NewUserSms()).
class NewUserSms extends BaseChannelMessage<SmsContract> {
  constructor(private readonly name: string | null) { super(); }
  toContract(): SmsContract {
    return { body: `¡Bienvenido a T4${this.name ? `, ${this.name}` : ""}! 🧋` };
  }
}

export class NewUserNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional"; // always sends — never opt-out-able

  via() {
    return ["mail", "database", "push", "sms", "realtime"];
  }

  toMail(n) { return { subject: "Welcome", html: `<p>Hi ${n.name ?? ""}</p>` }; }
  toSms(n)  { return new NewUserSms(n.name); }
  toPush(n) { return { title: "Welcome", body: `Hi ${n.name ?? ""}`, data: { kind: "welcome" } }; }
  toDatabase() { return { type: "welcome", title: "Welcome", body: "Glad you're here" }; }
  toRealtime() { return { event: "notification", data: { type: "welcome" } }; }
}
```

A channel listed in `via()` but missing its `toX()` is reported `skipped / no-method` — declare a superset and implement selectively. To make it dispatchable from the admin UI, register it (see Trigger.dev below).

## The six channels

| Channel | Renderer | Delegates to | Notes |
| --- | --- | --- | --- |
| `mail` | `toMail()` → `MailContract` | `@saas/email` | `to` defaults to the customer's email; skipped if null |
| `sms` | `toSms()` → `SmsContract` | `@saas/sms` | `to` defaults to the customer's phone |
| `push` | `toPush()` → `PushContract` | `@saas/push` | addresses by customer id; tokens resolved by the push manager (web only) |
| `whatsapp` | `toWhatsApp()` → `WhatsAppContract` | `@saas/whatsapp` | freeform `body` or `template` |
| `realtime` | `toRealtime()` → `RealtimeContract` | `@saas/realtime` | room defaults to `customer:<id>` |
| `database` | `toDatabase()` → `DatabaseContract` | `notification` table | the in-app feed; `category` is persisted automatically |

### Adding a new channel

Implement `NotificationChannel` (`name`, `method`, `send()`) and register it in the `channels` map passed to the `Notifier` in `packages/jobs/notifications.ts`. Add the matching `toX()` to `NotificationRenderers`. No core changes.

## Categories + preferences

Each notification has a `category`. Only **`marketing`** can be opted out of; `transactional`, `otp`, and anything else always send (requirement: OTP must always go through).

Preferences are per `(customer, channel)` rows in `notification_preference` — **absence of a row = subscribed**. `resolveChannels()` filters a marketing notification's channels by the customer's opt-outs; a filtered channel reports `skipped / opted-out` (visible in the `SendResult`, never silent). Customers manage this in their profile (`getMyPreferences` / `setPreference`).

## Using it with Trigger.dev

Sends are always dispatched through Trigger.dev — the API never runs the Notifier inline. Flow:

1. Admin calls `api.notifications.send({ customerIds, notificationKey })` → the service enqueues `tasks.trigger("send-notification", …)`.
2. `packages/jobs/trigger/send-notification.ts` resolves the class from the **registry** (`createNotification(key, payload)`) and calls `notifier.send({ customerId, organizationId }, notification)` per recipient.
3. The `notifier` (built in `packages/jobs/notifications.ts`) has every channel wired to its env-selected manager (log local / outbox preview / real prod).

To make a new notification sendable from admin: add the class to `packages/jobs/notifications-registry.ts`, map a key in `createNotification`, and extend the `notificationKey` enum in `packages/api/src/features/notifications/schemas.ts`.

## Testing

Use `notifier.fake()` / `notifier.restore()`, or the unit-level fakes for channels. The `FakeNotifier` records intent without touching any transport:

```ts
const fake = notifier.fake();
await runFlowThatNotifiesNewUser();
fake.assertSent(NewUserNotification);
fake.assertSentOnChannel(NewUserNotification, "mail");
fake.assertSentCount(NewUserNotification, 1);
notifier.restore();
```

For channel-level tests, inject a stub gateway (a `{ send }` that records the builder calls) — see `packages/notifications/src/test-fixtures.ts`.

## Common tasks

| Goal | Where |
| --- | --- |
| New notification type | subclass `Notification` (any package) + register in `notifications-registry.ts` |
| Make it dispatchable from admin | add to registry + `notificationKey` enum |
| Add a channel | implement `NotificationChannel` + register in `packages/jobs/notifications.ts` |
| Change which channels a customer can opt out of | `preferenceChannelSchema` in `schemas.ts` |
| Read / mark-read the in-app feed | `api.notifications.listMine` / `markRead` / `markAllRead` |
| Debug "channel didn't send" | inspect the `SendResult.results` — `reason` tells you (`opted-out` / `no-method` / `no-contact` / `not-registered`) |

## Why a separate orchestration layer

The transport packages stay single-purpose and dependency-free. The Notifier is the only place that knows "a welcome means mail + push + an in-app row," that a customer can mute marketing per channel, and that OTP can't be muted. New notifications are plain classes; new channels are plain adapters — both compose without touching the engine.
