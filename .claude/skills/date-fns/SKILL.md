---
name: date-fns
description: How to format, parse, and display dates in the next-saas-boilerplate monorepo. Use @saas/date (a thin wrapper over date-fns) for every date concern — formatting, relative time, parsing user input, calendar helpers. Never import date-fns directly in app/package code. Locale comes from next-intl. Use when adding a date column to a UI, fixing a "Invalid Date" rendering, building a "5 minutes ago" string, or wondering why hand-rolled date code keeps breaking.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# `@saas/date`

Single date surface for every app and package. Wraps **date-fns@4** with:

- A consistent set of presets (no more inline `format(d, "PPp", { locale: es })` scattered everywhere).
- Locale resolution from a string code (`"es"` / `"en"`) — driven by next-intl's `useLocale()` / `getLocale()`.
- A permissive `parseDate()` that returns `null` instead of the silent `Invalid Date` object you get from `new Date(badInput)`.
- An SSR-safe `<RelativeTime />` component and a live-updating `useRelativeTime()` hook for "hace 3 minutos" UIs.

```
packages/date/
├── package.json           ← exports: "." (server-safe) + "./react" (client-only)
├── src/
│   ├── index.ts           ← formatDate, formatTime, formatDateTime, formatRelative,
│   │                         formatDateRange, parseDate, isValidDate, isToday,
│   │                         isYesterday, startOfDay, endOfDay, esCO, enUS,
│   │                         localeFromCode
│   ├── format.ts
│   ├── parse.ts
│   ├── locales.ts         ← esCO (extends date-fns/locale/es with 12h time),
│   │                         enUS, localeFromCode(code) → Locale
│   └── react/
│       ├── index.ts       ← useRelativeTime, RelativeTime
│       ├── use-relative-time.ts   ← "use client", adaptive cadence + visibility-aware
│       └── relative-time.tsx      ← "use client", SSR renders absolute, swaps on mount
```

## The rule

**Never `import { format } from "date-fns"` in app or package code.** Import from `@saas/date` instead. Reasons:

- Locale handling is centralized — pass `{ locale }` (a string code) and the package resolves to the right date-fns `Locale` object. No risk of someone shipping a date in English on a Spanish page.
- The wrapper handles `null` / `undefined` / `""` / unparseable inputs gracefully (returns `""` from formatters, `null` from `parseDate`). Direct date-fns calls throw or render "Invalid Date" — both are bugs you'll find in production.
- Tree-shaking already happens via subpath imports inside the package (`date-fns/format`, `date-fns/parseISO`, etc.). Consumers don't need to think about it.
- The day Colombia decides we should output `p. m.` instead of `pm`, or the day we add a third locale, the override lives in one file.

## Server vs client

| Where you are | What to use | Notes |
| --- | --- | --- |
| Server Component / route handler | `formatDate(d, { locale })`, `formatRelative(d, { locale })` | Pass locale from `getLocale()` (next-intl/server). |
| Client Component (`"use client"`) | Same APIs, plus the React helpers from `@saas/date/react`. Pass locale from `useLocale()` if you call them directly. | The React hooks pick up locale automatically via `useLocale()`. |
| Anywhere you display "5 minutes ago" | `<RelativeTime date={...} />` from `@saas/date/react` | SSR-safe — server renders the absolute datetime, client upgrades to relative on mount. No hydration mismatch. |
| Parsing form input or query params | `parseDate(input)` | Returns `null` on garbage. Never trust `new Date(string)`. |

## Locale resolution

`localeFromCode(code)` maps a string code (as you'd get from next-intl) to a date-fns `Locale`:

- `"es"` / `"es-CO"` / `"es-MX"` / etc → `esCO` (date-fns/locale/es + 12h time format)
- `"en"` / `"en-US"` / `"en-GB"` → `enUS`
- Anything else → `esCO` (silent fallback, never throws)

When `<Calendar>` from `@saas/ui` needs a `locale` prop (react-day-picker expects a date-fns Locale), pass `esCO` / `enUS` directly — they're re-exported from the package root.

## Usage examples

### Server component (RSC)

```tsx
import { getLocale } from "next-intl/server";
import { formatDate, formatDateTime } from "@saas/date";

export default async function CardPage() {
  const locale = await getLocale();
  const created = "2026-05-11T15:30:00Z";

  return (
    <p>
      Tarjeta creada el {formatDate(created, { locale })} a las {formatDateTime(created, { locale, preset: "short" })}.
    </p>
  );
}
```

### Client component with live relative time

```tsx
"use client";
import { RelativeTime } from "@saas/date/react";

export function StampTimestamp({ at }: { at: string }) {
  // SSR: "11 may 2026 a las 3:30 pm" → after hydration: "hace 5 minutos" → updates live
  return <RelativeTime date={at} className="text-sm text-muted-foreground" />;
}
```

### Parsing user input

```ts
import { parseDate } from "@saas/date";

function onSubmit(raw: FormDataEntryValue | null) {
  const date = parseDate(raw);
  if (!date) {
    // empty, invalid, garbage — handle as missing input
    return;
  }
  // date is a real, validated Date
}
```

## Patterns that catch real bugs

### `formatDate(null)` doesn't throw

A user with no `createdAt` shouldn't crash the page. All formatters return `""` for nullish or unparseable input. Render `format... || "—"` if you want a placeholder.

### `parseDate("2026-05-11")` returns midnight **UTC**

This is the single biggest date footgun in a Bogotá-timezone app. `parseISO` (and the underlying `Date` constructor) treats a date-only ISO string as UTC midnight, which renders as the *previous day's evening* in `America/Bogota`.

If you have a pure date (no time component), parse it as `parseDate("2026-05-11T00:00:00")` for local-midnight semantics. The skill `parse.ts` docstring repeats this warning.

### `useRelativeTime` adapts its tick interval

- < 1 minute: ticks every second (so "hace 5 segundos" → "hace 6 segundos" feels live)
- < 1 hour: ticks every minute
- < 1 day: ticks every hour
- ≥ 1 day: no ticks (the value isn't going to change visibly)

Plus: the timer pauses when `document.visibilityState === "hidden"` (saves CPU on backgrounded tabs) and resumes on `visibilitychange`.

### `<RelativeTime />` over `useRelativeTime`

Default to the component. It:

- Renders absolute datetime during SSR + first client paint → no hydration mismatch.
- Wraps output in `<time dateTime={iso} title={absolute}>` — screen readers, tooltips, and crawlers all see the canonical ISO timestamp.
- Adds `suppressHydrationWarning` so React doesn't whine about the mount-time swap.

Reach for the hook directly only when you need the string inside another layout (e.g., to pass into an aria-label) and have already handled SSR yourself.

## Red flags in review

- **`import { format } from "date-fns"` outside `packages/date`** — replace with `@saas/date`.
- **`new Date(someString)` for parsing** — replace with `parseDate(someString)`. `new Date("not a date")` returns an Invalid Date that silently renders as the string "Invalid Date".
- **A page using `formatDate` without a locale** — the function will fall back to `esCO`, which is fine on a Spanish page but a bug on an English one. Always pass `{ locale }` from `useLocale()` / `getLocale()`.
- **A custom "hace X minutos" implementation with `setInterval(updater, 1000)`** — replace with `<RelativeTime />`. The hand-rolled version usually misses the visibility pause, doesn't adapt cadence, and creates a hydration mismatch.
- **Date-only ISO strings (`"2026-05-11"`) passed straight to formatters** — be sure you want UTC semantics. If you want local midnight, append `T00:00:00`.

## When NOT to use this package

- **Timestamps that never display** (logs, audit records, DB columns) — just store ISO strings or epoch ms, no formatting needed.
- **Cron expressions / interval math** — date-fns has helpers but those are different domain. Use the underlying date-fns API directly if you really need them, but consider whether your business logic belongs elsewhere (`@saas/jobs`?).
- **Currency / number formatting** — not this package. `Intl.NumberFormat` covers it.

## See also

- `next-intl` skill — where the locale comes from. Drop a date into a JSX file and reach for `useLocale()` first, not for a date-fns import.
- `ui` skill — the `Calendar` primitive accepts a date-fns `Locale`; pass `esCO` / `enUS` from this package.
