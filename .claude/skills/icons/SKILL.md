---
name: icons
description: How icons work in the next-saas-boilerplate monorepo. Default to lucide-react for almost everything; convert custom/brand SVGs into typed React components with @svgr/cli (web flavor) and ship them from @saas/ui. Use when adding an icon to web/admin/ui, picking lucide vs a custom glyph, converting a raw .svg the designer handed you, tinting/sizing an icon, or debugging "my custom icon won't change color / shows clipped".
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

# Icons — `lucide-react` first, `@svgr/cli` for the rest

Two sources, one rule of thumb:

1. **`lucide-react` — the default for ~everything.** Already a dependency of
   `@saas/ui`, `apps/web`, and `apps/admin`. Pin'd at `^0.469.0`. If lucide
   has the glyph, use it — don't hand-draw or convert an SVG.
2. **`@svgr/cli` (web) — only for what lucide lacks:** the T4 brand mark, a
   next-saas-boilerplate-card glyph, a partner logo, a one-off illustration. Raw `.svg` →
   typed React component, committed into `@saas/ui` and consumed like any
   other export.

> Adapted from WeMetVia mobile's `svgr-icons` skill — but that one targets
> `react-native-svg`. **We are web (DOM SVG).** The `--native` flag and the
> two react-native post-processing fixes (`Ref<Svg>`, stripping `xmlns`) **do
> not apply here** and must not be copied over. See "What's different from the
> RN skill" at the bottom.

---

## Using lucide (the 95% case)

Named import, size with a Tailwind `size-*` class, color inherits from text:

```tsx
import { Coffee, Gift, Star } from "lucide-react";

<Coffee className="size-4" />                 // 16px, inherits currentColor
<Gift className="size-5 text-primary" />      // 20px, brand-tinted
<Star className="size-4 text-muted-foreground" />
```

- **Size** → Tailwind `size-4` (16), `size-5` (20), `size-6` (24). Avoid the
  `size` prop; keep sizing in classes so it matches the rest of the UI.
- **Color** → lucide strokes use `currentColor`, so `text-primary`,
  `text-destructive`, etc. just work. Never pass `color="#…"`.
- **Stroke width** → leave the default (2). Only override (`strokeWidth={1.5}`)
  for a deliberate lighter weight, app-wide, not per-call.
- This is exactly how the shadcn components already consume icons
  (`packages/ui/src/components/ui/*.tsx`) — match that.

Don't re-export lucide icons from `@saas/ui`; import them straight from
`lucide-react` at the call site. Only **custom** glyphs live in `@saas/ui`.

---

## Custom icons: where they live

```
packages/ui/src/icons/
├── svg/                 raw source .svg files (designer hands you these)
│   ├── t4-logo.svg
│   └── next-saas-boilerplate-card.svg
├── t4-logo.tsx          generated — typed React component (committed)
├── next-saas-boilerplate-card.tsx     generated
└── index.ts             barrel — re-exports every generated icon
```

Wire the barrel into the package's public API once:

```ts
// packages/ui/src/index.ts
export * from "./icons";
```

(Optionally add `"./icons": "./src/icons/index.ts"` to `exports` in
`packages/ui/package.json` if you want the subpath import too.)

Like shadcn components, **the generated `.tsx` files are yours** — committed,
reviewable, hand-editable. Re-running SVGR overwrites them; review the diff.

---

## Canonical command (web)

`@svgr/cli` is **not** a dependency — invoke it with `npx` (downloads on the
fly), same as the RN skill:

```bash
npx --yes @svgr/cli --typescript --jsx-runtime automatic --ref --icon \
  --replace-attr-values "#000=currentColor" \
  --svgo-config '{"plugins":[{"name":"preset-default","params":{"overrides":{"removeViewBox":false}}}]}' \
  --out-dir packages/ui/src/icons packages/ui/src/icons/svg
```

Flag by flag:

- **No `--native`** → emits DOM SVG (`<svg><path/></svg>`) with `SVGProps`,
  which is what Next.js / React DOM wants.
- `--icon` → sets `width`/`height` to `1em` and **keeps the `viewBox`**. This
  gives custom icons the **same DX as lucide**: they size to the font (or a
  Tailwind `size-*` class) and tint via `currentColor`. Use this even for
  non-square glyphs — `preserveAspectRatio` defaults to `xMidYMid meet`, so
  they scale without distortion.
- `--ref` → wraps in `forwardRef`. On web the emitted ref type is
  `Ref<SVGSVGElement>`, which is **already correct** — no sed fix-up (that was
  an RN quirk).
- `--typescript` + `--jsx-runtime automatic` → `.tsx` with `SvgProps`, no
  unused `import * as React` (matches the repo's `react-jsx`).
- `--replace-attr-values "#000=currentColor"` → the tinting hook (see below).
- `--svgo-config '…removeViewBox:false…'` → keep the `viewBox` so the glyph
  scales. Pass it as **inline JSON** (a file path is rejected). With `--icon`
  the viewBox is preserved anyway, but be explicit — never omit this.

---

## Tinting: pick the right base color

SVGR runs SVGO first, which **normalizes color names to hex**: `fill="white"`
→ `#fff`, `fill="black"` → `#000`, `#000000` → `#000`. So
`--replace-attr-values` must match the **post-SVGO** value, not the raw one:

| Raw SVG fill | Use in `--replace-attr-values` |
| ------------ | ------------------------------ |
| `black` / `#000000` | `#000=currentColor` |
| `white` | `#fff=currentColor` |
| a brand hex you want left alone | don't replace it — multi-color logos keep their fills |

After conversion the path is `fill="currentColor"`. On **web**, `currentColor`
resolves from the CSS `color` property — so it inherits the text color, and a
Tailwind `text-*` class tints it. **No `color` prop** (that was the RN path).

```tsx
import { T4Logo } from "@saas/ui";

<T4Logo className="size-6 text-primary" />     // tinted by text color
```

Multi-color brand logos: skip `--replace-attr-values` (or replace only the one
fill you want themeable) so the other colors survive.

---

## Filenames & formatting (repo conventions)

SVGR emits PascalCase files (`T4Logo.tsx`) and a `Svg`-prefixed component name.
This repo's components are **kebab-case** (`button.tsx`, `next-saas-boilerplate-card.tsx`) —
lowercase the files to match:

```bash
cd packages/ui/src/icons
for f in *.tsx; do mv "$f" "$(echo "$f" | sed -E 's/([a-z0-9])([A-Z])/\1-\2/g' | tr '[:upper:]' '[:lower:]')"; done
```

(The internal `SvgT4Logo` component name is cosmetic — rename it in the file if
you like, but only the **filename** matters for lint.) Then run the repo's own
toolchain — **oxformat + oxlint, not prettier/eslint**:

```bash
bun run format        # oxformat (turbo)
bun run lint          # oxlint — packages/ui runs `oxlint src`
```

Finally add each icon to the barrel and a friendly export name:

```ts
// packages/ui/src/icons/index.ts
export { default as T4Logo } from "./t4-logo";
export { default as IntrigoCard } from "./next-saas-boilerplate-card";
```

---

## Add a Storybook story (optional but encouraged)

Custom icons are visual — document them next to the shadcn components:

```tsx
// apps/storybook/stories/icons.stories.tsx
import { T4Logo, IntrigoCard } from "@saas/ui";
// render a grid at a few sizes / text colors
```

See the `ui` skill for the CSF 3 story shape.

---

## When you need icon-by-key (dynamic)

Default to **named imports** — they tree-shake and a typo is a compile error.
Only build a registry when the icon name comes from data (a tier, a category):

```ts
import type { ComponentType, SVGProps } from "react";
import { Bronze, Silver, Gold } from "@saas/ui";

// Typing it as a COMPLETE Record<Tier, …> makes a missing/misspelled key a
// compile error.
export const TIER_ICONS: Record<Tier, ComponentType<SVGProps<SVGSVGElement>>> = {
  bronze: Bronze,
  silver: Silver,
  gold: Gold,
};
```

---

## Decision flow

1. **Does lucide have it (or a close-enough glyph)?** → use `lucide-react`. Stop.
2. **Brand/custom glyph?** → drop the `.svg` in `packages/ui/src/icons/svg/`,
   run the canonical command, lowercase + format, add to the barrel, consume
   from `@saas/ui`.
3. **Static asset, not an inline icon** (favicon, PWA `apple-touch-icon`, OG
   image)? → that's not this skill. Those stay raw `.svg`/`.png` under
   `apps/web/public/icons/` and are wired by the **`pwa`** skill.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Custom icon won't change color | The fill is a hardcoded hex, not `currentColor`. Re-run with the right `--replace-attr-values` (match the **post-SVGO** value — `#000`, not `black`). |
| Icon shows clipped / only a corner | `viewBox` got stripped. You omitted the inline svgo config (`removeViewBox:false`). Re-run with it. |
| Icon ignores `size-*` and renders huge | You dropped `--icon`, so it kept the source `width`/`height`. Re-run with `--icon`. |
| Lint flags `import * as React` | Missing `--jsx-runtime automatic`. |
| Filename lint error | SVGR emitted PascalCase — lowercase to kebab-case (snippet above). |
| Multi-color logo went mono | `--replace-attr-values` replaced every fill. Drop it, or scope it to the single themeable color. |

---

## What's different from the RN skill (don't copy these)

The WeMetVia `svgr-icons` skill targets `react-native-svg`. On **web** these
steps are wrong and must be skipped:

- **No `--native`** — we want DOM SVG, not `<Svg><Path/></Svg>`.
- **No `Ref<SVGSVGElement>` → `Ref<Svg>` sed** — `Ref<SVGSVGElement>` is the
  correct web type.
- **No `xmlns` removal** — DOM `<svg>` accepts `xmlns`; it's harmless.
- **Tint via CSS `color` / Tailwind `text-*`, not a `color` prop** — web
  `currentColor` resolves from the cascade, not a root-element prop.
