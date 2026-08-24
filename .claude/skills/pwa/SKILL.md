---
name: pwa
description: Build, debug and extend the apps/web Progressive Web App. Use when adding install/offline behavior, debugging the service worker, refreshing brand icons or theme colors, tightening cache strategy, or onboarding a teammate to "how is the PWA wired".
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# PWA — apps/web installable + offline

`apps/web` (the customer-facing tea-shop next-saas-boilerplate app) ships as an installable PWA. Users open it in mobile browser, get an install prompt, and can launch it from the home screen as if it were native. Loss-of-network shows a branded offline page instead of the browser's "you are offline" stub. API calls (Hono RPC) intentionally don't cache — only static assets and HTML do.

```
apps/web/
├── app/
│   ├── manifest.ts          ← Next 15 metadata route → /manifest.webmanifest
│   ├── sw.ts                ← service worker entry, compiled by @serwist/next
│   ├── icon.tsx             ← favicon (32px) generated from theme color + initial
│   ├── apple-icon.tsx       ← apple-touch-icon (180px)
│   ├── offline/page.tsx     ← shown when SW falls back from a failed nav
│   └── layout.tsx           ← mounts <InstallPrompt />, sets viewport + appleWebApp
├── components/
│   └── install-prompt.tsx   ← captures `beforeinstallprompt`, exposes a button
├── lib/
│   └── pwa.ts               ← isStandalone(), registerInstallPromptListener()
├── public/
│   └── icons/
│       ├── icon.svg         ← manifest icon (any purpose)
│       └── icon-maskable.svg← manifest icon (maskable, safe-zone padded)
└── next.config.ts           ← wrapped with withSerwist
```

Stack: **`@serwist/next`** (Next 15 + App Router successor to `next-pwa`) + **`serwist`** (Workbox successor). Both pinned in `apps/web/package.json`.

---

## Install criteria (what makes it installable)

A PWA must satisfy ALL of these for Chrome to offer the install prompt:

1. **HTTPS** (or `localhost` in dev). Vercel preview/prod is HTTPS by default.
2. **Service worker with a `fetch` handler.** `app/sw.ts` registers one via `Serwist.addEventListeners()`.
3. **Web app manifest** declaring `name`, `start_url`, `display` (standalone/fullscreen/minimal-ui), `icons` (≥ 192px and ≥ 512px). Served at `/manifest.webmanifest` via `app/manifest.ts`.
4. **First-party origin** — the user landed via http(s) navigation, not via a popup/iframe with no top-level interaction.

If install isn't being offered, run a Lighthouse PWA audit (DevTools → Lighthouse → Progressive Web App) — it tells you which criterion is missing.

---

## Cache strategy (what we precache vs runtime cache vs ignore)

Configured in `app/sw.ts`:

| Resource | Strategy | Why |
| --- | --- | --- |
| `_next/static/*` (chunks, images) | `defaultCache` → cache-first, long TTL | Hashed URLs; safe to cache aggressively. |
| HTML page navigations | network-first, fall back to `/offline` | Always show fresh content when online; never block the user when offline. |
| `/api/*`, `/the API/*` | **NOT cached** (network-only) | Auth + user-scoped data; stale would be wrong. |
| `/monitoring` (Sentry tunnel) | passes through untouched | It's a POST; `defaultCache` only caches GET navigations/assets, so the SW never intercepts it. No `app/sw.ts` change needed. See the `sentry` skill. |
| Images | cache-first, 30-day TTL | Mostly static next-saas-boilerplate assets. |
| Web fonts | cache-first | Same. |

`defaultCache` from `@serwist/next/worker` already applies these conventions; we add the offline fallback for HTML on top.

---

## Local development

PWA is **disabled in dev** (`next.config.ts` → `disable: process.env.NODE_ENV === "development"`). Otherwise the SW would fight Next.js HMR every save. To exercise it locally:

```bash
cd apps/web
bun run build
bun run start    # next start --port 3002
```

Then in Chrome:

1. Visit http://localhost:3002.
2. DevTools → **Application** → **Manifest** — should list "Intrigo" and the two SVG icons.
3. DevTools → **Application** → **Service Workers** — should show `sw.js` as "activated and running".
4. DevTools → **Lighthouse** → check "Progressive Web App" → Generate report. Aim for ≥ 90.
5. Click the install icon in the URL bar (the small + symbol). Should open the install dialog.
6. Test offline: DevTools → **Network** → Throttling: "Offline" → reload. The `/offline` page should appear; reconnect and reload to resume.

---

## Refreshing icons / brand color

Today the icons are **placeholder SVGs** with a green background and the letter "L" — generated to satisfy the manifest spec until the T4 brand kit confirms colors and logo.

To swap them out:

1. **Theme color**: change every occurrence of `#16a34a` in:
   - `apps/web/app/manifest.ts` (`theme_color`)
   - `apps/web/app/layout.tsx` (`viewport.themeColor`)
   - `apps/web/app/icon.tsx` and `apple-icon.tsx` (background `#16a34a`)
   - `apps/web/app/offline/page.tsx` (the brand mark `bg-green-600`)
   - `apps/web/components/install-prompt.tsx` (`bg-green-600`/`hover:bg-green-700`)
   - `apps/web/public/icons/icon.svg` and `icon-maskable.svg` (`<rect fill="#16a34a">`)
2. **Replace the SVGs**: drop new artwork into `apps/web/public/icons/icon.svg` and `apps/web/public/icons/icon-maskable.svg`. The maskable variant should keep its safe zone (padded inside the 512px box, no important content within ~80px of the edges — Android crops aggressively).
3. **Rebuild and hard-refresh**. Service workers cache aggressively; bumping the manifest is not enough on a device that already installed. DevTools → Application → Service Workers → "Unregister", then reload.

---

## When the user already installed

We don't show the install button if `isStandalone()` returns true (`display-mode: standalone` matches, or iOS' `navigator.standalone === true`). The `<InstallPrompt />` component checks this on mount.

If you want to test the prompt against a fresh state on Chrome:
- Site Settings → Reset permissions → Reload — Chrome will offer install again.

iOS Safari **does not fire `beforeinstallprompt`** — install is manual via Share → "Add to Home Screen". Document that in any "how to install" copy aimed at iOS users; the button still won't appear there.

---

## Common gotchas

### "Service worker registration failed"

Service workers only register on HTTPS or `localhost`. On a plain HTTP IP (e.g. visiting `http://192.168.1.x:3002` from a phone), Chrome silently refuses. Use ngrok/Tailscale or stick to localhost + Chrome remote devices for mobile testing.

### "I deployed a SW change but old users still see the old code"

Service workers cache themselves. The Serwist config sets `skipWaiting: true` + `clientsClaim: true`, so on next page navigation the new SW takes over. But pages already open hold the old SW until reload. If you need a forced update, either:
- bump the version of a precached asset (changes the manifest, triggers update), or
- in production, use `swr-version` style cache busting in app code.

### Chrome devtools say "manifest icon failed to load"

Likely the SVG has no explicit `width`/`height` attributes, or a typo in the `src`. Open the icon URL directly (`http://localhost:3002/icons/icon.svg`) and verify it renders.

### "The PWA installs but offline shows a blank page"

`/offline` page is server-rendered and gets precached on the first online visit. If a user installs the app while offline (rare), the precache is empty — the network-first fallback can't find `/offline`. There is no good fix; ensure the user's first visit is online (the typical flow anyway).

### Knip flags `apps/web/app/sw.ts` as unused

Service worker entries aren't imported by app code (Serwist injects the manifest at build time). The repo's `knip.json` lists `app/sw.ts` as an explicit entry for the web workspace. If you move or rename it, update knip.

---

## When to bring it further (out of MVP scope)

- **Push notifications** — Implemented in `@saas/push` + `apps/web/app/sw.ts` (`push` + `notificationclick` listeners). The browser subscription helper is `apps/web/src/lib/push-subscription.ts`; the React hook + button live in `apps/web/src/features/push/`. See `.claude/skills/push/SKILL.md` for the full data flow, registration UX, and how the abstraction shares with Expo Push for the future native app.
- **Background sync** — IndexedDB queue for actions taken offline (e.g. "I scanned my QR but had no signal"), reconciliation when online. Bigger refactor of a POST routes; tracked in Linear.
- **Periodic sync** — refresh user's points on a schedule even when the app is closed. Limited browser support; revisit when more devices ship it.

---

## References

- Serwist docs: https://serwist.pages.dev/
- Next 15 metadata routes (manifest, icon, apple-icon): https://nextjs.org/docs/app/api-reference/file-conventions/metadata
- PWA install criteria (Chrome): https://web.dev/install-criteria/
- Maskable icon safe-zone tester: https://maskable.app/editor

Files referenced in this skill:

- `apps/web/next.config.ts` — Serwist wrap
- `apps/web/app/manifest.ts` — manifest definition
- `apps/web/app/sw.ts` — service worker entry
- `apps/web/app/icon.tsx` / `apple-icon.tsx` — generated icon endpoints
- `apps/web/app/offline/page.tsx` — offline fallback
- `apps/web/app/layout.tsx` — viewport + appleWebApp + `<InstallPrompt />` mount
- `apps/web/components/install-prompt.tsx` — install button
- `apps/web/lib/pwa.ts` — detection helpers
- `apps/web/public/icons/icon.svg` / `icon-maskable.svg` — manifest icons
- `knip.json` — `app/sw.ts` declared as web workspace entry
