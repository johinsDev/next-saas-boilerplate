---
name: email
description: Send transactional emails from the next-saas-boilerplate monorepo via `@saas/email` and author templates with `@saas/email-templates` (React Email + Tailwind). Use when triggering a send (welcome, password reset, points earned, OTP), adding a new transport, authoring/previewing a template, switching provider per environment, debugging Resend / outbox delivery, or reviewing the email outbox.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# @saas/email + @saas/email-templates — Email for the next-saas-boilerplate monorepo

Two cooperating packages:

- **`@saas/email`** — provider-agnostic *sender*. Owns the `EmailManager`, the `EmailMessage` fluent builder, the `BaseEmail` typed-send class, and the 4 transports (`resend`, `log`, `folder`, `outbox`).
- **`@saas/email-templates`** — React Email templates rendered to HTML strings. Each template is a React component wrapped in the shared `EmailLayout` brand shell. The `react-email` CLI serves them at `http://localhost:3008` for visual previews.

Sender is decoupled from author: subclasses of `BaseEmail` import templates from `@saas/email-templates`, render to HTML, and hand the string to the message builder. The two packages can evolve independently.

Same shape as `@saas/sms` / `@saas/whatsapp`: same strategy pattern, same `FakeSender` API, same manager. Patterns transfer between channels.

---

## Where things live

### `@saas/email` (sender)

| What | Where |
| --- | --- |
| Package | `packages/email/src/` |
| Public API | `packages/email/src/index.ts` |
| `EmailManager` (named mailers + routing) | `packages/email/src/manager.ts` |
| `EmailSender` (one per transport) | `packages/email/src/sender.ts` |
| `EmailMessage` (fluent builder) | `packages/email/src/email-message.ts` |
| `BaseEmail` (typed sends) | `packages/email/src/base-email.ts` |
| Transports | `packages/email/src/transports/{resend,log,folder,outbox}.ts` |
| `FakeSender` | `packages/email/src/fake-sender.ts` |
| Errors | `packages/email/src/errors.ts` |
| Schemas (zod + priority) | `packages/email/src/schemas.ts` |
| Factories (`fakeMessage`, `fakeResponse`) | `packages/email/src/factories.ts` |
| Unit tests | `packages/email/src/__tests__/` |

### `@saas/email-templates` (templates)

| What | Where |
| --- | --- |
| Package | `packages/email-templates/` |
| Public API | `packages/email-templates/src/index.ts` |
| `renderEmail()` (re-export of `@react-email/render`) | `packages/email-templates/src/render.ts` |
| `EmailLayout` brand shell | `packages/email-templates/src/components/email-layout.tsx` |
| Templates | `packages/email-templates/src/templates/<name>-email.tsx` |
| CLI preview entries (one re-export per template) | `packages/email-templates/emails/<name>.tsx` |
| Preview server script (`bun run dev`) | `email dev --dir emails --port 3008` |

### Wiring (consuming apps)

| What | Where |
| --- | --- |
| Web bootstrap | `apps/web/src/lib/email.ts` |
| Admin bootstrap | `apps/admin/src/lib/email.ts` |
| Drizzle outbox table | `packages/db/src/schema/email-outbox.ts` |
| Hono RPC feature (list/get) | `packages/api/src/features/email-outbox/` |
| Web dev view | `apps/web/app/[locale]/(dev)/email-outbox/` |
| Admin panel | `apps/admin/app/[locale]/(dashboard)/email-outbox/` |
| E2E endpoint | `apps/web/app/api/email-outbox/` |

---

## Sending an email

### Quick (inline, callback style)

For one-off sends. The callback receives an `EmailMessage` and configures it directly.

```ts
import { email } from "@/lib/email";

await email.send((m) =>
  m
    .to("lucia@example.com", "Lucía")
    .subject("Recordatorio")
    .text("Tu tarjeta está a un sello del premio."),
);
```

`html` and `text` are both optional individually, but **at least one is required** — `toData()` throws otherwise. Provide both when you can: clients without HTML support fall back to text.

### Class style (preferred for anything reused)

Extend `BaseEmail`, implement `prepare()`. The class owns its template, props, and copy; callers just instantiate and send.

```ts
// packages/jobs/.../trigger/notifications/welcome-email.ts
import { renderEmail, WelcomeEmail as WelcomeTemplate } from "@saas/email-templates";
import { BaseEmail } from "@saas/email";

export class WelcomeEmail extends BaseEmail {
  constructor(
    private readonly to: string,
    private readonly name: string,
    private readonly ctaUrl: string,
  ) {
    super();
  }

  async prepare(): Promise<void> {
    const html = await renderEmail(
      <WelcomeTemplate name={this.name} ctaUrl={this.ctaUrl} />,
    );
    this.message
      .to(this.to, this.name)
      .subject(`¡Bienvenida, ${this.name}!`)
      .html(html);
  }
}

// callsite:
await email.send(new WelcomeEmail(user.email, user.name, cardUrl));
```

`BaseEmail.shouldSend()` is the opt-out hook for queue handlers — override and return `false` to short-circuit (quiet hours, marketing preferences, per-user opt-out). `build()` is idempotent: calling `send()` twice on the same instance runs `prepare()` once.

### `EmailMessage` builder surface

The fluent setters validate at `toData()` time, so partial chains during `prepare()` are fine.

| Setter | Notes |
| --- | --- |
| `.to(address, name?)` / `.to({address, name?})` | Repeatable. Address validated via `emailAddressSchema`. |
| `.from(address, name?)` | Optional if `resend.from` is configured on the provider. |
| `.replyTo(...)` | Single recipient. |
| `.cc(...)` / `.bcc(...)` | Repeatable. |
| `.subject(text)` | Required. 1–998 chars (RFC 2822). |
| `.html(string)` / `.text(string)` | At least one required. |
| `.header(key, value)` | Arbitrary headers — merged with provider-injected ones. |
| `.tag(name, value)` | Resend tags (forwarded as-is). |
| `.priority("low" \| "normal" \| "high")` | Mapped to `X-Priority` (5/3/1). |
| `.attach({filename, content, contentType?})` | `content` is `Buffer` or base64 string. |

---

## Providers

Four transports, selected by name. All implement `EmailTransport` (`{ name, send(data) → EmailResponse }`).

| Provider | When to use | What it does |
| --- | --- | --- |
| `resend` | Production | Posts to Resend HTTP API. Lazy-imports the SDK so the package can be installed without it. Maps 429 → `RateLimitError(60s)`, other failures → `ProviderError`. |
| `log` | Local dev | Writes one structured `email.sent` line to `@saas/log`. No filesystem, no network. |
| `folder` | Visual local dev | Writes `<uuid>.json` + `<uuid>.html` to `EMAIL_PREVIEW_DIR` (default `.email-previews/`). Inbox-style HTML preview with iframe-sandboxed body. `openInBrowser: true` auto-opens (skipped in prod/CI). |
| `outbox` | Preview deploys + E2E | Inserts a row into `email_outbox` (Drizzle). Feeds the `/email-outbox` dev view + `/api/email-outbox` endpoint used by Playwright. Lazy-imports the schema. |

### Provider selection in `apps/{web,admin}/src/lib/email.ts`

```ts
function pickDefaultProvider() {
  if (env.EMAIL_PROVIDER) return env.EMAIL_PROVIDER;
  if (process.env.VERCEL_ENV === "production") return "resend";
  if (process.env.VERCEL_ENV === "preview")    return "outbox";
  return "log";                                                // local dev
}
```

Override per-runtime with `EMAIL_PROVIDER=<log|folder|outbox|resend>` in `.env`.

The bootstrap pre-builds every mailer it can — `undefined` entries (e.g. `resend` with no API key) are stripped by the manager so misconfiguration only blows up when you actually try to *use* that mailer.

### Required env per provider

| Provider | Required env | Validated in |
| --- | --- | --- |
| `resend` | `RESEND_API_KEY`, `EMAIL_FROM` | `apps/{web,admin}/src/env.ts` (boots fail when `EMAIL_PROVIDER=resend` and either is missing) |
| `folder` | `EMAIL_PREVIEW_DIR` (optional, defaults to `.email-previews/`) | n/a |
| `log` | none | n/a |
| `outbox` | `DATABASE_URL` (Drizzle `db`) | already enforced at the DB layer |

> **`resend` is an optional peer dep of `@saas/email`** (provider-agnostic by
> design), so the runtime that actually *uses* the resend transport must install
> `resend` itself. All system email funnels through **Trigger.dev (`@saas/jobs`)**
> — the auth Worker only enqueues — so `resend` lives in `packages/jobs/package.json`.
> If you hit `MissingDependencyError: [resend] resend is not installed`, it's a
> **two-place fix**: (1) add `resend` to the consuming package's `dependencies`
> (fixes local `trigger dev`), **and** (2) add `resend@^4` to `additionalPackages`
> in `packages/jobs/trigger.config.ts` (the Trigger *deploy* prunes it otherwise —
> it's in `build.external` + obfuscated dynamic import, so package.json alone won't
> ship it). Mirrors how `web-push` is wired. See the `env-deploy` skill.

> **Prod deliverability (DNS).** Sends go from the verified subdomain
> `mail.t4diverclub.app` (Resend, `us-east-1`). The Cloudflare `t4diverclub.app`
> zone holds **DKIM + SPF + DMARC** (`_dmarc` TXT = `v=DMARC1; p=none; …`, added
> 2026-06-09 — Resend's per-email *Insights* tab flags a missing DMARC). Prod and
> dev/preview use **separate** Resend keys (sending-only, domain-scoped); the
> Resend MCP authenticates with yet another key (`MCP_RESEND_API_KEY` in `.env`).
> Verify any Resend key with a real `POST /emails` — a sending-only key 401s on
> `GET /domains` even when valid.

### Switching mailers explicitly

```ts
await email.use("resend").send(new WelcomeEmail(...));   // force resend
await email.use("outbox").send(...);                     // force outbox
```

`email.use()` with no arg returns the default mailer. Senders are cached per name inside the manager — first `use("resend")` constructs the transport, subsequent calls reuse it.

---

## Authoring a template

Templates live in `packages/email-templates/src/templates/<name>-email.tsx`. Every one wraps its content in `EmailLayout` for the brand shell (header + content card + footer).

1. **Create the template component** under `src/templates/`:

   ```tsx
   // src/templates/password-reset-email.tsx
   import { Button, Heading, Text } from "@react-email/components";
   import { EmailLayout } from "../components/email-layout";

   export interface PasswordResetEmailProps {
     name: string;
     resetUrl: string;
   }

   export function PasswordResetEmail({ name, resetUrl }: PasswordResetEmailProps) {
     return (
       <EmailLayout preview={`Reestablecé tu contraseña, ${name}`}>
         <Heading className="text-ink text-2xl font-semibold m-0 mb-3">
           Hola, {name}
         </Heading>
         <Text className="text-ink text-base leading-6 m-0 mb-4">
           Pediste reestablecer tu contraseña. El enlace expira en 30 minutos.
         </Text>
         <Button
           href={resetUrl}
           className="bg-brand text-brand-fg px-6 py-3 rounded-md no-underline box-border inline-block"
         >
           Cambiar contraseña
         </Button>
       </EmailLayout>
     );
   }

   PasswordResetEmail.PreviewProps = {
     name: "Lucía",
     resetUrl: "https://t4.app/reset?token=demo",
   } satisfies PasswordResetEmailProps;
   ```

2. **Export it** from `src/index.ts`:

   ```ts
   export { PasswordResetEmail, type PasswordResetEmailProps } from "./templates/password-reset-email";
   ```

3. **Add a CLI preview entry** at `emails/<name>.tsx` (the `react-email` CLI scans this folder; each file must `export default`):

   ```tsx
   // emails/password-reset.tsx
   import { PasswordResetEmail } from "../src/templates/password-reset-email";
   export default PasswordResetEmail;
   export { PasswordResetEmail };
   ```

4. **Preview it**: `bun --cwd packages/email-templates run dev` and open `http://localhost:3008`. `PreviewProps` is what the CLI uses to render — keep it realistic (real names, sensible URLs).

### Author rules (email clients are not browsers)

These trip every new template author at least once.

- **Use `<EmailLayout>` as the outer element.** It mounts `<Html>` → `<Head>` → `<Tailwind>` → `<Body>` + brand header/footer. Don't roll your own.
- **No flexbox, no grid.** Outlook + several mobile clients drop them. Use `<Section>` + Tailwind block utilities (`block`, `inline-block`, `text-center`).
- **No media queries, no `dark:`.** Coverage across clients is too patchy to rely on.
- **`<Button>` needs `box-border`.** Without it, padding overflows the rounded background in some clients.
- **Borders need an explicit type.** Use `border-solid` (or `border-dashed` etc.). Tailwind defaults to no explicit type, which Outlook drops.
- **`pixelBasedPreset` is required on `<Tailwind>`.** Email clients don't support `rem`. The shared `EmailLayout` already configures this.
- **Always set a `preview` prop on `<EmailLayout>`.** It's the snippet shown next to the subject in most inboxes — first impression.
- **Tailwind tokens are inline on `EmailLayout`** (not from `@saas/ui`). Email clients won't run the app's CSS pipeline, so the palette is duplicated. Current tokens: `brand` `#16a34a`, `brand-fg` `#fff`, `ink` `#0f172a`, `muted` `#64748b`, `surface` `#f8fafc`.

### Plain-text alternative

For accessibility (screen readers, clients with HTML off), render a text version:

```ts
const html = await renderEmail(<WelcomeTemplate name="Lucía" ctaUrl="..." />);
const text = await renderEmail(<WelcomeTemplate name="Lucía" ctaUrl="..." />, { plainText: true });

this.message.to(...).subject(...).html(html).text(text);
```

---

## Testing

Activate the fake sender. Every send is captured; `restore()` switches back to the real transport for the next test.

```ts
import { email } from "@/lib/email";
import { WelcomeEmail } from "@/features/auth/welcome-email";

beforeEach(() => email.fake());
afterEach(() => email.restore());

it("sends welcome email on sign-up", async () => {
  const fake = email.fake();
  await signUpFlow({ email: "lucia@example.com", name: "Lucía" });

  fake.assertSent(WelcomeEmail, (m) =>
    m.message.toData().to.some(
      (r) => (typeof r === "string" ? r : r.address) === "lucia@example.com",
    ),
  );
  fake.assertSentCount(WelcomeEmail, 1);
});

it("does not email opted-out users", async () => {
  const fake = email.fake();
  await signUpFlow({ email: "x@x.com", marketingOptIn: false });
  fake.assertNoneSent();
});
```

The `FakeSender` keeps two arrays:
- `sent: BaseEmail[]` — instances passed to `send()`. Match by class via `assertSent(cls, findFn?)`.
- `sentMessages: EmailMessageData[]` — compiled wire payloads. Use for callback-style sends that don't go through a `BaseEmail`.

For unit-testing a transport directly, use `fakeMessage()` / `fakeResponse()` from `@saas/email`.

---

## Adding a new transport

Follow the same recipe as `@saas/sms` and `@saas/whatsapp`:

1. Implement `EmailTransport` in `packages/email/src/transports/<name>.ts`.
2. Add a `XxxProviderConfig` variant to `ProviderConfig` (`packages/email/src/types.ts`).
3. Wire it into `createTransport()` in `packages/email/src/manager.ts`.
4. Add a UT at `packages/email/src/__tests__/transports/<name>.test.ts`.
5. If the transport persists, add columns to `email_outbox` and run `bun run db:generate`.
6. Reference the new config from `apps/{web,admin}/src/lib/email.ts`'s bootstrap.
7. If the transport depends on an optional SDK, **lazy-import it** (mirror `ResendTransport.#getClient()`) so the package stays installable without it. Throw `MissingDependencyError(provider, packageName)` on import failure.
8. If knip can't see the dep (CLI-only or dynamic import), add it to `packages/<pkg>` → `ignoreDependencies` in `knip.json`.

---

## Dev view at `/email-outbox`

URL: `http://localhost:3002/es/email-outbox` (or `/en/`). Same gate as the WhatsApp/SMS outboxes — `isDevOnlyEnabled()` returns 404 in production. Lives in `app/[locale]/(dev)/`; the parent layout runs the gate so leaf pages stay clean.

Same blueprint as the other outbox views: nuqs filters (`to` partial via ILIKE, `search` against subject/body, status pill), pagination, Suspense + skeleton, RSC for fetch. The detail page renders the stored HTML in a sandboxed iframe so an email's CSS can't bleed into the dev UI.

Backed by 2 route handlers under `emailOutbox` (`packages/api/src/features/email-outbox/`):

```ts
api.emailOutbox.list({ to?, status?, search?, page, pageSize });
api.emailOutbox.get({ id });
```

Both `a public route` — gated by env at the page + endpoint layer, not by auth. Layering follows `.claude/skills/api-filters/SKILL.md` (router → service → repository, Drizzle only in repo).

---

## Errors

All inherit from `EmailError`. Stable `code` field for retry middleware / alerts:

| Class | `code` | When |
| --- | --- | --- |
| `InvalidEmailError` | `INVALID_EMAIL` | Address fails `emailAddressSchema` (thrown by setters). |
| `InvalidMessageError` | `INVALID_MESSAGE` | Missing recipient/subject/body at `toData()` time. |
| `RateLimitError` | `RATE_LIMIT` | Resend 429. Carries `retryAfterMs` (defaults to 60_000). |
| `ProviderError` | `PROVIDER_ERROR` | Catch-all wrapping the transport's failure. Carries `provider`, `providerCode?`, `cause?`. |
| `MissingDependencyError` (extends `ProviderError`) | `PROVIDER_ERROR` | Optional SDK not installed (e.g. `resend`). Message includes the `bun add` hint. |

`InvalidEmailError` / `InvalidMessageError` are *programmer errors* — surface them, don't retry. `ProviderError` / `RateLimitError` are *runtime errors* — retry policy lives in the caller (Trigger.dev task config, etc.), not in this package.

---

## Common tasks

| Goal | Where |
| --- | --- |
| Send a transactional email | `BaseEmail` subclass + `email.send(new WelcomeEmail(...))` |
| One-off inline send | `email.send((m) => m.to(...).subject(...).html(...))` |
| Switch to Resend in preview | set `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `EMAIL_FROM` |
| Preview a template locally | `bun --cwd packages/email-templates run dev` → `localhost:3008` |
| See sent emails locally without a Resend key | `EMAIL_PROVIDER=outbox` then visit `/es/email-outbox` |
| Render-only (no send) | `import { renderEmail, WelcomeEmail } from "@saas/email-templates"` |
| Assert no email sent in a test | `email.fake().assertNoneSent()` |
| Add a new typed email class | extend `BaseEmail`, implement `prepare()` |
| Add a new template | new component under `src/templates/`, re-export from `src/index.ts`, preview entry under `emails/` |
| Add a new transport | see "Adding a new transport" above |
| Plain-text alternative | `renderEmail(<Component/>, { plainText: true })` |

---

## Why two packages?

Keeping the *sender* separate from the *templates* means:

- Trigger.dev jobs and route handlers can `import { BaseEmail } from "@saas/email"` without dragging React/JSX into a non-rendering runtime.
- `@saas/email-templates` owns React Email + `@react-email/components`. Everything else is a string.
- The `react-email` preview CLI scans one folder (`packages/email-templates/emails/`) and stays isolated from the rest of the build.
- Apps that only need to *send* (workers) don't pull the template runtime; apps that only need to *render* (potential future digest tooling) don't pull the transports.

Mirrors how `@saas/whatsapp` and `@saas/sms` separate their channel logic from the template authoring surface — same playbook for a different medium.
