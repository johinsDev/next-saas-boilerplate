---
name: next-intl
description: How i18n is wired in the next-saas-boilerplate monorepo with next-intl. Both apps/web and apps/admin are internationalized with the same pattern. Use when adding a new locale, translating a route, wiring a new server/client component to translations, fixing a "Failed to compile" because someone imported from `next/link`, adding a new translatable route, or onboarding a teammate to "where do the strings live and how is the language detected".
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

# next-intl — i18n for the next-saas-boilerplate monorepo

Single i18n pattern shared by `apps/web` (customer PWA) and `apps/admin` (internal CRM). Locale-aware routing, server- and client-side translation APIs, automatic language detection, and a typed navigation API that replaces `next/link` and `next/navigation`.

Each app has the same shape:

```
apps/<app>/
├── i18n/
│   ├── routing.ts         ← defineRouting: locales, defaultLocale, localePrefix, pathnames map
│   ├── request.ts         ← getRequestConfig: load messages per locale
│   └── navigation.ts      ← createNavigation: typed Link / useRouter / usePathname / redirect
├── messages/
│   ├── es.json            ← canonical source; keys live here first
│   └── en.json
├── proxy.ts               ← createMiddleware(routing) — locale detection + redirects (Next 16 file convention)
├── app/
│   ├── layout.tsx         ← ROOT: html/body, reads NEXT_LOCALE cookie for <html lang>
│   ├── [locale]/
│   │   ├── layout.tsx     ← setRequestLocale + NextIntlClientProvider + LocaleSwitcher
│   │   ├── page.tsx       ← server component, getTranslations(...)
│   │   └── …routes        ← English-canonical folders; pathnames map translates public URLs
│   └── api/               ← excluded from proxy matcher
└── components/
    └── locale-switcher.tsx← client component, uses Button from @saas/ui
```

App-specific extras:

- `apps/web/app/offline/` + `apps/web/app/sw.ts` + `apps/web/app/manifest.ts` are locale-agnostic (PWA surface).
- `apps/web/components/install-prompt.tsx` uses `useTranslations("Common")`.
- `apps/admin` has no PWA layer.

Stack: **`next-intl@4`** + **Next 16** App Router. The `proxy.ts` filename replaces `middleware.ts` (renamed in Next 16). Both apps run on the same convention; if you add a new app, copy the same trio (`i18n/`, `messages/`, `proxy.ts`).

---

## The rule

**Never import `Link`, `useRouter`, `usePathname`, or `redirect` from `next/link` / `next/navigation` inside any localized route.**
Always import from `@/i18n/navigation`. The typed wrappers know about locale prefixes and the `pathnames` map; the raw Next.js ones don't and will silently route you to the wrong locale's URL.

API routes, the service worker, and the offline page are the only places where the raw Next imports are acceptable, because they're locale-agnostic.

---

## How a request flows

```
Browser   →   middleware.ts             →   app/[locale]/layout.tsx       →   page.tsx
   │              │                              │                              │
   │              ├─ reads Accept-Language       ├─ awaits params               ├─ setRequestLocale(locale)
   │              ├─ reads NEXT_LOCALE cookie    ├─ hasLocale guard → notFound  ├─ getTranslations("Foo")
   │              ├─ picks matching locale       ├─ setRequestLocale(locale)    └─ renders
   │              ├─ rewrites/redirects URL      ├─ <NextIntlClientProvider>
   │              └─ sets NEXT_LOCALE cookie     └─ renders children
```

Language detection priority (next-intl default):

1. Cookie `NEXT_LOCALE` — sticky, set by the middleware on every redirect.
2. `Accept-Language` header — best match against `routing.locales`.
3. Fallback to `routing.defaultLocale` (`es`).

---

## Server vs client vs static — cheat sheet

| Where you are | What to use | Notes |
| --- | --- | --- |
| **Server Component** (default) | `getTranslations("Namespace")`, `getFormatter()`, `getNow()`, `getTimeZone()` from `next-intl/server` | Call `setRequestLocale(locale)` at the top of the page **and** of every layout above it, otherwise static rendering breaks. |
| **Client Component** (`"use client"`) | `useTranslations("Namespace")`, `useLocale()`, `useFormatter()` from `next-intl` | Works automatically — `NextIntlClientProvider` in `[locale]/layout.tsx` supplies the messages. |
| **`generateMetadata`** | `getTranslations({ locale, namespace: "Metadata" })` | Always pass `locale` explicitly. Metadata runs outside the request context, so no `setRequestLocale` magic. |
| **Static rendering (SSG)** | `generateStaticParams()` in `[locale]/layout.tsx` + `setRequestLocale(locale)` in every page **and** layout that calls `getTranslations` | Without `setRequestLocale`, Next falls back to dynamic rendering and SSG is silently lost. |
| **Navigation** | `Link`, `useRouter`, `usePathname`, `redirect`, `getPathname` from `@/i18n/navigation` | Never from `next/link` or `next/navigation`. |
| **Server actions / route handlers** | `getLocale()` from `next-intl/server` | Locale comes from the `NEXT_LOCALE` cookie set by middleware. |
| **Middleware-excluded routes** (`/api/*`, `/offline`, `/sw.js`, static assets) | Plain Next APIs | No translations available — those routes don't go through `NextIntlClientProvider`. |

---

## Routing

```ts
// apps/web/i18n/routing.ts
export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "as-needed",   // /perfil (es) vs /en/profile (en)
  pathnames: {
    "/": "/",
    "/profile": { es: "/perfil",  en: "/profile" },
    "/card":    { es: "/tarjeta", en: "/card" },
  },
});
```

- **`localePrefix: "as-needed"`** keeps default-locale URLs clean (Spanish gets `/perfil`) and prefixes the others (English gets `/en/profile`). Switching to `"always"` would force every URL to carry the prefix.
- **`pathnames`** maps a canonical *internal* route (the folder name under `[locale]/`) to per-locale *public* URLs. **Folders are in English** — they're code, and the repo convention is code-in-English — while the visible URL is translated per locale. So `[locale]/profile/page.tsx` is reachable at `/perfil` (es) and `/en/profile` (en).
- Always write `<Link href="/profile">` (the canonical English route key). The typed navigation API auto-translates it to the user's current locale's URL at render time.
- Adding a new translatable route: create the folder under `[locale]/` with an English name, add an entry to `pathnames` mapping the canonical key to the per-locale URLs, add keys to `messages/{es,en}.json`.

---

## Adding a new locale

1. Append the code to `routing.locales` in `apps/web/i18n/routing.ts`.
2. Create `apps/web/messages/<code>.json` mirroring the existing namespace shape. **Every key in `es.json` must exist** — VSCode's i18n-ally will flag missing keys inline.
3. If any route's slug should differ in that locale, add it to the `pathnames` map.
4. Add a label entry to `LABELS` in `apps/web/components/locale-switcher.tsx`.

That's it. No code changes in pages — `getTranslations` and `useTranslations` pick up the new locale automatically.

---

## Locale switcher

`apps/web/components/locale-switcher.tsx` is a tiny client component built on `Button` from `@saas/ui`. With only two locales today it's a toggle — when a third locale lands it should grow into a dropdown (use Base UI `Menu` or the future shadcn `Select` that's planned for `@saas/ui`).

Two things it does that aren't obvious:

- Wraps `router.replace` in `useTransition` so the page stays interactive while Next routes — without this, the button gives no feedback during the locale switch.
- Calls `router.replace` (not `push`) so the locale switch doesn't pollute browser history.

---

## VSCode integration

`.vscode/extensions.json` recommends `lokalise.i18n-ally`. Once installed, it:

- Inlines the resolved translation next to every `t("key")` call.
- Flags missing keys in any locale's JSON file.
- Lets you edit translations side-by-side from a dedicated panel (⌘⇧P → "i18n Ally: Open Editor").
- Auto-detects framework via `i18n-ally.enabledFrameworks: ["next-intl"]` in `.vscode/settings.json`.

If a teammate opens the repo and i18n-ally doesn't activate: check that `.vscode/settings.json` is committed (it is) and that `apps/web/messages/{es,en}.json` exist.

---

## Adding a new app

Both `apps/web` and `apps/admin` are set up. If a third app joins the monorepo, mirror the same pattern:

1. `bun add next-intl --filter @saas/<new>` (or `cd apps/<new> && bun add next-intl`).
2. Copy `apps/web/i18n/` to `apps/<new>/i18n/`. Adjust the `pathnames` map for routes specific to that app.
3. Copy `apps/web/proxy.ts` to `apps/<new>/proxy.ts`. Adjust the matcher if the app has different excludes (admin's matcher is simpler — no PWA paths to skip).
4. Wrap `apps/<new>/next.config.ts` with `createNextIntlPlugin("./i18n/request.ts")`.
5. Move route folders under `apps/<new>/app/[locale]/`, renaming to English canonical names.
6. Write the minimal root `app/layout.tsx` (html/body + cookie-driven `<html lang>`) and provider-bearing `[locale]/layout.tsx`.
7. Seed `apps/<new>/messages/{es,en}.json`.
8. Copy `apps/web/components/locale-switcher.tsx` (10 lines — duplicating is cheaper than abstracting it into `@saas/ui`, which is locale-agnostic by design).
9. Update `.vscode/settings.json`: append the new app's `messages/` directory to `i18n-ally.localesPaths`.
10. Update `apps/<new>/package.json` lint script to cover `i18n proxy.ts components` in addition to whatever was there.

---

## Testing pattern

For components that use `useTranslations`, wrap them in `NextIntlClientProvider` with mock messages:

```tsx
import { NextIntlClientProvider } from "next-intl";
import { render } from "@testing-library/react";

function renderWithIntl(ui: React.ReactNode, locale = "es") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ Common: { install: "Instalar app" } }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}
```

For server components that use `getTranslations`, call `setRequestLocale(locale)` first in the test setup, or render via Next's test utilities. Most server-component logic is better unit-tested at the data layer, not the JSX.

---

## Red flags in review

- **Import from `next/link` or `next/navigation` inside `app/[locale]/**` or `components/**`** — replace with `@/i18n/navigation`.
- **A page calls `getTranslations` but doesn't call `setRequestLocale(locale)` first** — the page silently switches to dynamic rendering. Add the call.
- **A new route appears under `[locale]/` but isn't in the `pathnames` map** — either it doesn't need translated URLs (skip), or it does and was forgotten (add it).
- **Inline Spanish strings in JSX inside `[locale]/`** — move them to `messages/es.json` (and add the English version).
- **`messages/es.json` and `messages/en.json` diverge in shape** — i18n-ally will catch this; CI doesn't yet (TODO: add a structural diff check).
- **A locale switcher built without `useTransition`** — UI freezes during the switch. Wrap `router.replace` in `startTransition`.
- **`<html lang>` hardcoded to `"es"` somewhere** — the root layout reads `NEXT_LOCALE` cookie; don't override it downstream.

---

## `proxy.ts`, not `middleware.ts`

Next 16 renamed the request-interception file convention. We use **`proxy.ts`** in both apps.

- `middleware.ts` is deprecated in Next 16 and will be removed. Don't create it.
- next-intl's `createMiddleware` itself is unchanged — it returns the same function regardless of which file you put it in. The repo imports it as `createMiddleware` from `next-intl/middleware` (the package didn't rename its export), then default-exports it from `proxy.ts`. The next-intl docs still call this file `middleware.ts` in places; treat that as documentation drift — on Next 16, use `proxy.ts`.
- If you upgrade an older repo from 15.x to 16.x and need the rename done for you, Next provides a codemod: `npx @next/codemod@canary middleware-to-proxy .`. It renames the file and (for non-default exports) the exported function name.

## See also

- `pwa` skill — interaction with the PWA offline fallback URL (`/offline` is locale-agnostic on purpose).
- `tooling` skill — commit scope-enum (`web` for app-level i18n changes; `repo` for skill/CLAUDE.md docs).
- Future `@saas/date` package will derive its locale from `useLocale()` / `getLocale()` — never hardcode locale in date formatters.
