---
name: ui
description: Component library for the next-saas-boilerplate monorepo. @saas/ui ships every shadcn/ui component built on top of Base UI primitives, with Storybook 9 in apps/storybook for visual docs. Use when adding or modifying components, tuning theme tokens, writing stories, switching dark mode, or debugging a Base-UI-specific quirk.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# UI — `@saas/ui` + shadcn (Base UI) + Storybook

The customer PWA (`apps/web`) and the staff CRM (`apps/admin`) share `@saas/ui` — a copy-paste shadcn library where every primitive is **Base UI** (`@base-ui/react`), not Radix. Storybook 9 in `apps/storybook` renders every component as visual documentation.

```
packages/ui/
├── components.json                       shadcn config (style: base-nova, base color: neutral)
├── src/
│   ├── cn.ts                             clsx + tailwind-merge wrapper
│   ├── index.ts                          barrel — re-exports every component
│   ├── components/ui/                    55 shadcn components (copy-paste; you own them)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── …
│   └── hooks/
│       └── use-mobile.ts                 SSR-safe responsive breakpoint hook
└── styles/
    └── globals.css                       Tailwind v4 @theme tokens (light + dark)

apps/storybook/
├── .storybook/{main,preview}.ts          framework + theme decorators
├── stories/<name>.stories.tsx            one CSF 3 file per component
├── vite.config.ts                        Vite + Tailwind v4 plugin
└── vercel.json                           deploy as 3rd Vercel project (static output)
```

---

## What "shadcn copy-paste" means here

shadcn is not an npm dependency for components. The CLI **copies the component source into our repo**. We own those files — modify them in place, commit, ship. This is unlike Material UI or Chakra where you'd wrap or theme via props.

Practical implications:

- To change a button's hover state, **edit `packages/ui/src/components/ui/button.tsx` directly**. Don't wrap it.
- shadcn won't auto-update components for you. To pull the latest shadcn template, you re-run the CLI and review the diff.
- The component files have `cn` imported via `../../cn` (relative), not `@/cn` (alias). This is so consumer apps don't need to know about `@/` aliases.

---

## Adding a new component

```bash
cd packages/ui
bunx shadcn@latest add <component>
```

The CLI:

1. Reads `packages/ui/components.json` to figure out where files go.
2. Writes the component to `src/components/ui/<component>.tsx`.
3. Adds any missing npm deps to `packages/ui/package.json`.

After the CLI finishes:

1. Add the component to the barrel: `export * from "./components/ui/<component>";` in `src/index.ts`.
2. Replace any `@/cn`, `@/components/ui/X` imports in the new file with relative paths (`../../cn`, `./X`). The bulk pattern: `sed -i '' -e 's|"@/cn"|"../../cn"|g' -e 's|"@/components/ui/\([^"]*\)"|"./\1"|g' src/components/ui/<component>.tsx`.
3. Write a story in `apps/storybook/stories/<component>.stories.tsx`. Use the CSF 3 template the other stories follow.
4. Run `bun run typecheck && bun run lint && bun --cwd apps/storybook run build` before committing.

---

## Customising an existing component

Just edit the file. It's yours. Examples:

- **Change padding on the Card header** → edit `src/components/ui/card.tsx`.
- **Add a new Button variant** → extend the `cva` variants in `src/components/ui/button.tsx` and the `ButtonProps` type.
- **Replace the icon library** (lucide → something else) → edit each component that imports from `lucide-react`. Update `components.json#iconLibrary`.

---

## Theme tokens

Defined in `packages/ui/styles/globals.css` as CSS custom properties under `:root` (light) and `.dark` (dark). The `@theme inline` block maps each variable into a Tailwind utility name (`bg-primary` → `var(--primary)`).

Tokens:

| Group | Variables |
| --- | --- |
| Surfaces | `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground` |
| Brand | `primary`, `primary-foreground` |
| Neutrals | `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground` |
| Semantic | `destructive`, `destructive-foreground` |
| Borders / focus | `border`, `input`, `ring` |
| Charts | `chart-1` … `chart-5` |
| Sidebar | `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring` |
| Radii | `radius` (root), derived `radius-sm/md/lg/xl` via `@theme inline` |
| Typography | `font-sans`, `font-mono` |

All colors are in **oklch**. To swap brand colors:

1. Update `--primary`, `--primary-foreground`, `--ring`, `--sidebar-primary` in both `:root` and `.dark` blocks.
2. Storybook auto-updates (HMR + Vite reads `@saas/ui/styles/globals.css`).

Today's primary is a green chosen to match the T4 tea-shop pilot (`oklch(0.59 0.18 145)` ≈ `#16a34a`). Replace with the franchise's official palette when it lands.

---

## Dark mode

Add the `.dark` class to `<html>` (or any ancestor). The `@custom-variant dark (&:is(.dark *))` directive at the top of `globals.css` makes every `dark:` Tailwind utility resolve against that class.

In Storybook the global toolbar has a Light/Dark toggle that flips `document.documentElement.classList`. In `apps/web` and `apps/admin`, hook it up to `next-themes` (already in deps) on the layout when the user has a preference toggle.

---

## Writing stories

Convention: one `.stories.tsx` per component in `apps/storybook/stories/`. CSF 3, no MDX docs.

```ts
import { Button } from "@saas/ui";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};
export default meta;

export const Default = { render: () => <Button>Click me</Button> };
export const Outline = { render: () => <Button variant="outline">Outline</Button> };
```

Rules:

- `tags: ["autodocs"]` so the Docs tab is generated (props table comes from `react-docgen-typescript`).
- One named export per variant/size/state. Story labels match the variant names where possible.
- Compound components (Card with header/footer; Dialog with trigger/content) → one composite story per file showing real usage. Don't split into per-piece stories.
- For interactive components that need state (Calendar, Switch as controlled), inline a `useState` inside `render`.
- Avoid story-level `args`-only stories; render the component explicitly. Easier to scan.

---

## Storybook locally + on Vercel

```bash
bun --cwd apps/storybook run dev    # http://localhost:6006
bun --cwd apps/storybook run build  # produces apps/storybook/storybook-static/
```

Vercel project: `next-saas-boilerplate-storybook`. Configured via `apps/storybook/vercel.json` — framework `null`, build command uses turbo with `--filter=@saas/storybook`, output is `storybook-static/`. Auto-deploys on push to `main` (production) and on every PR (preview). See the `vercel` skill for the project setup checklist.

---

## Base UI gotchas (different from Radix)

Most shadcn templates assume Base UI APIs. Key differences if you're migrating snippets from Radix-flavored docs:

- **`render` prop instead of `asChild`** on most Base UI primitives. `<DialogTrigger render={<Button />} />` instead of `<DialogTrigger asChild><Button /></DialogTrigger>`. Exceptions: components that don't use Base UI (Drawer = vaul, Calendar = react-day-picker, Sonner toaster, Command = cmdk) still use `asChild` or just plain children.
- **Accordion / ToggleGroup** don't take `type="single" | "multiple"`. The behavior is encoded in the primitive itself or via composition.
- **Tabs / Combobox** group labels are separate components (`ComboboxLabel`) — there's no `heading` prop on the group wrapper.
- **`useRender` + `mergeProps`** from `@base-ui/react` is how some components compose without `asChild`. You may see this in Badge, Breadcrumb, etc.

When in doubt, **look at the source** in `packages/ui/src/components/ui/<name>.tsx`. It's plain TSX, ~100 lines per component.

---

## Components that are NOT Base UI

shadcn delegates some primitives to other libraries because Base UI doesn't ship them (yet):

| Component | Underlying library | Why |
| --- | --- | --- |
| `Calendar`, `CalendarDayButton` | `react-day-picker` v9 | Best-in-class date primitives |
| `Carousel` | `embla-carousel-react` | Same |
| `Command` | `cmdk` | Same |
| `Drawer` | `vaul` | Mobile-first drawer pattern |
| `Sonner` (Toast) | `sonner` | Base UI doesn't have a native Toast |
| `Chart` | `recharts` | Charting primitives |
| `Resizable` | `react-resizable-panels` | Same |
| `InputOTP` | `input-otp` | Specialized component |

These exceptions are documented at the top of each component file.

---

## Picking a date

Two components, and picking the wrong one is the usual mistake:

| Need | Component |
| --- | --- |
| A calendar date near today — schedule a campaign, filter a range, set an end date | `DatePicker` / `DateRangePicker` (Button trigger + `Calendar` in a `Popover`) |
| A **date of birth** | `DateWheelPicker` |

A birthday is decades away from today. A calendar makes you page through ~300
months to reach 1998; the wheel spins straight to it. Never `<input type="date">`
— its rendering is browser-specific and it can't be themed.

### `WheelPicker` — the primitive

`packages/ui/src/components/ui/wheel-picker.tsx`, adapted from
[beui.dev](https://beui.dev/components/motion/wheel-picker). An iOS-style drum:
options ride a 3D cylinder driven by one float row index; a flick coasts on real
momentum (`DECELERATION` / `MAX_VELOCITY` constants at the top) and springs into
its detent.

```tsx
<WheelPicker
  options={["sm", "md", "lg"]}          // or [{ label, value }]
  value={size}
  onValueChange={setSize}
  visibleCount={5}                       // odd; more rows = flatter curve
  itemHeight={44}
  variant="card"                         // "bare" to share a parent's band
  sound                                  // opt-in Web Audio tick, default off
  aria-label="Tamaño"
/>
```

Things worth knowing before you touch it:

- **The list is rendered twice.** A dimmed copy for the whole drum and a crisp
  copy clipped to the centre band, both driven by the same transform so they
  register exactly. Change one, change the other.
- **Touch and wheel listeners are bound natively, non-passively** (in an effect),
  because React's synthetic `touchmove`/`wheel` handlers are passive and their
  `preventDefault()` is a no-op — the page would scroll instead of the drum.
- **`prefers-reduced-motion` swaps the whole render** for a plain snap-scroll
  list. Any feature you add to the drum needs an answer in that branch too.
- **The role is `spinbutton`, not `listbox`.** Both option copies are
  `aria-hidden` (they'd be announced twice), so upstream's `listbox` advertised a
  list with no options and no value. `spinbutton` + `aria-valuetext` describes
  what this actually is: one value, stepped with the arrow keys.
- **Sound is off by default** and synthesized at runtime (`wheel-picker.tick-sound.ts`)
  — no asset ships. One `AudioContext` is shared and ref-counted across every
  wheel on the page.

### `DateWheelPicker` — three wheels, one control

Composes a day / month / year `WheelPicker` in `variant="bare"` under a single
highlighted band. Controlled and i18n-agnostic — it never formats anything
itself:

```tsx
<DateWheelPicker
  value={draft}                          // { day, month: 1-12, year }
  onValueChange={setDraft}
  monthLabels={monthLabels}              // 12 localized names, index 0 = January
  dayLabel={t("dayLabel")}               // headings AND accessible names
  monthLabel={t("monthLabel")}
  yearLabel={t("yearLabel")}
/>
```

- **Leave `maxYear` unset.** The default upper bound is *today*, so a future
  birth date can't be picked at all. `maxYear` / `maxDate` override it; `minYear`
  defaults to 1925.
- **The wheels stay consistent.** February offers 28 or 29 days depending on the
  year currently on the year wheel, and bounds are enforced per column: scroll to
  the current year and the month wheel stops at the current month, and that month
  at today's day. All of that is `normalizeDate` in `date-wheel-picker.lib.ts` —
  pure, and the place to add rules (it has a full test suite).
- **It corrects the parent.** If `value` is out of range or impossible
  (31 February), it renders the normalized date *and* calls `onValueChange` with
  it, so the parent's state stops disagreeing with the screen.
- **`order`** re-arranges the columns (`["month", "day", "year"]` for en-US).
- **Open it in a `ResponsiveModal`**, don't inline it — see the `responsive-modal`
  skill. Both admin call sites and the web profile do this.

Persisting a birthday: the `customer.birthday` column is a **timestamp**, so
write UTC midnight of the picked day (`Date.UTC(year, month - 1, day)`) and read
it back with `getUTC*` / `timeZone: "UTC"`. Anything else drifts a day for
customers behind UTC.

---

## Common gotchas

### Editing a shadcn file breaks somewhere I didn't change

Components reference each other (Toggle → ToggleGroup, Card → CardHeader, Dialog → DialogContent…). If you change the API on one, the consumer story breaks. Always rebuild Storybook locally before committing.

### `Cannot find module '@/cn'` after adding a new component

shadcn writes `@/cn` aliases that only resolve against `packages/ui`'s own tsconfig `paths`. Consumer apps don't know about that alias. Run the sed rewrite shown in "Adding a new component" to convert to relative imports.

### Tailwind utilities show no styling

The token isn't in `@theme inline` block of `globals.css`. Either you missed adding it when extending, or the component references a token that doesn't exist (typo, or an upstream shadcn change). Check the @theme block.

### Storybook can't find `@saas/ui`

`apps/storybook/vite.config.ts` doesn't alias `@saas/ui` — it relies on Bun's workspace resolution. If you broke `package.json#exports` in `packages/ui`, Vite can't resolve the subpath. Verify the exports map matches the file layout.

### Build fails: "Could not load /packages/ui/src/index.ts/styles/globals.css"

You added a too-eager Vite alias that resolves `@saas/ui` to `index.ts` AND breaks `@saas/ui/styles/globals.css` lookup. Remove the alias and let workspace resolution handle it.

---

## When to bring it further (out of MVP scope)

- **Visual regression**: Storybook + Chromatic (or Playwright snapshots in `apps/e2e`) once the library is in active use.
- **Composable form helpers**: shadcn's `useForm` + `Form` patterns layered on top of the Form components.
- **Brand kit**: replace placeholder tokens with the official T4 palette when design lands.
- **Storybook test runner**: `@storybook/test-runner` to assert each story renders without console errors in CI.

---

## References

Files referenced in this skill:

- `packages/ui/components.json` — shadcn registry config
- `packages/ui/src/cn.ts` — class merger utility
- `packages/ui/src/index.ts` — public barrel
- `packages/ui/src/components/ui/*.tsx` — every shadcn component (you own these)
- `packages/ui/styles/globals.css` — Tailwind v4 @theme tokens
- `apps/storybook/.storybook/main.ts` — Storybook config
- `apps/storybook/.storybook/preview.ts` — preview decorators + theme toggle
- `apps/storybook/vite.config.ts` — Vite + Tailwind plugin
- `apps/storybook/vercel.json` — deploy config

External:

- shadcn/ui — https://ui.shadcn.com
- Base UI — https://base-ui.com
- Storybook 9 — https://storybook.js.org
- Tailwind v4 — https://tailwindcss.com
