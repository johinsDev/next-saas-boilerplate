---
name: ui-motion
description: Animate customer screens consistently — staggered fade-up entrances (useFadeUp/FadeUp), shared-element motion (framer-motion layoutId), reduced-motion, count-up and confetti. Read before adding any UI animation in apps/web.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# ui-motion — animating the customer PWA

Motion in `apps/web` is **mostly plain CSS keyframes driven by inline `style`**, gated by the user's reduced-motion preference. We reach for the `motion` (framer-motion) library only for **layout / shared-element** animation that CSS can't express (a pill that slides between two elements). Keep that split — don't pull framer-motion in for a fade.

The customer app is mobile-first; animations must feel native, never block interaction, and **always respect `prefers-reduced-motion`**.

---

## The pieces

| What | Where | Use for |
| --- | --- | --- |
| `useFadeUp()` / `<FadeUp>` | `apps/web/src/lib/animate.tsx` | Staggered fade-up entrance of list/grid items and page sections |
| `tw-fade-up` keyframe | `apps/web/app/globals.css` | The shared entrance keyframe (opacity + 12px translateY) |
| `useReducedMotion()` | `apps/web/src/lib/use-reduced-motion.ts` | Gate any motion; returns `false` on the server + first client render (no hydration mismatch), flips after mount |
| `CountUp` | `apps/web/src/lib/count-up.tsx` | Animate a number counting up (jumps to final value under reduced motion) |
| `celebrate(...)` | `apps/web/src/lib/celebrate.tsx` | One-shot confetti for wins (skipped under reduced motion) |
| `motion` / `AnimatePresence` | `motion/react` (dep of `apps/web`) | Shared-element + layout animation only (e.g. the bottom-nav pill) |

---

## Staggered fade-up — the default entrance

This is the motion the history list established and the one to reuse everywhere. Two flavors of the same thing:

### Per-item (lists & grids) — the hook

`useFadeUp()` returns a **style factory**. Spread `style={fade(i)}` on each item; they fade in one after another. Use this in **client** components that map over data.

```tsx
import { useFadeUp } from "@/lib/animate";

function Grid({ items }: { items: Item[] }) {
  const fade = useFadeUp();
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it, i) => (
        <Card key={it.id} style={fade(i)} />
      ))}
    </div>
  );
}
```

If the item is a component, give it a `style?: React.CSSProperties` prop and forward it to the root element (we own our cards — that's the shadcn copy-paste model). When the root already has a `style` (e.g. a gradient), **merge**: `style={{ backgroundImage: ..., ...style }}`.

### Per-section (incl. server components) — the wrapper

`<FadeUp index={n}>` renders a `div` with the fade applied. It's a client component, so it works **inside a server component** (e.g. `home.tsx`) — only the boundary is client, children stay server-rendered.

```tsx
import { FadeUp } from "@/lib/animate";

<FadeUp index={0}><GreetingHeader /></FadeUp>
<FadeUp index={1} className="mt-5 grid gap-4 lg:grid-cols-2">
  <PointsCard />
  <StampsCard />
</FadeUp>
```

`className` lands on the wrapper, so move the section's layout classes (`mt-*`, `grid`, …) onto `<FadeUp>` rather than nesting another div.

### Options

`useFadeUp({ step, duration, base })` / `<FadeUp step duration base>`:
- `step` — ms between items (default `60`)
- `duration` — seconds (default `0.45`)
- `base` — ms before the first item (default `0`)

### Where it's applied (reference)

- **Per-item**: menu drinks, rewards grid + redemptions, promos featured + list, notifications cards, history list.
- **Per-section**: home, store, profile, notifications header/filters.

---

## Reduced motion is not optional

Every animation path must degrade. The helpers already do: `useFadeUp` returns `undefined` (renders in place), `CountUp` shows the final number, `celebrate` no-ops. If you hand-roll an animation, gate it yourself:

```tsx
const reduced = useReducedMotion();
style={reduced ? undefined : { animation: "tw-fade-up .45s ease-out backwards" }}
```

Why `useReducedMotion` starts `false`: server and first client render must match. It reads `matchMedia` in an effect and flips after mount — so the first paint is identical on both sides, no hydration warning.

---

## Hand-rolled keyframes (one-offs)

For motion specific to one component (not the shared entrance), define a local `@keyframes` in an inline `<style>` and drive it with inline `style`. Examples already in the tree: `stamps-card.tsx` (`tw-zoom-in` stamp pop, `t4StampGlow` reward glow). Keep these local; only promote a keyframe to `globals.css` when more than one view needs it (that's how `tw-fade-up` got there).

`motion-safe:` Tailwind utilities (e.g. `motion-safe:animate-in motion-safe:zoom-in-50`) are fine for tiny one-time pops — they're already reduced-motion-aware via the `motion-safe` variant.

---

## framer-motion — only for shared-element / layout

`motion` (framer-motion v12, `motion/react`) is in `apps/web` for animations CSS can't do: an element that **slides between two positions** or **resizes as layout changes**. The canonical use is the **bottom-nav pill** (`apps/web/src/components/bottom-nav.tsx`): a single `layoutId="navPill"` element that travels between tabs.

```tsx
import { motion, AnimatePresence } from "motion/react";

// shared element: the same layoutId in the active tab → it animates between them
{active ? (
  <motion.span
    layoutId="navPill"
    transition={{ type: "spring", stiffness: 380, damping: 32 }}
    className="bg-primary/10 absolute inset-0 rounded-2xl"
  />
) : null}
```

Two requirements for `layoutId` to actually travel:
1. The component must stay **mounted** across the change. The bottom nav lives once in the locale layout (not per page) precisely so it isn't remounted on navigation — a remount kills the shared-element animation.
2. Only the **active** instance renders the `layoutId` element; framer matches the same id across renders and tweens position/size.

Use `AnimatePresence` for enter/exit (e.g. a label that grows in). Don't reach for `motion` when a CSS fade/scale would do — it's heavier and we want the dep footprint small.

---

## Conventions

- **No arbitrary Tailwind values** for static styling (tokens + standard scale). Durations/delays are **data-driven inline `style`**, which is allowed — that's exactly what `useFadeUp` emits. `env(safe-area-*)` is allowed.
- Don't animate `width`/`height`/`top`/`left` in CSS for layout moves — use `transform` (the keyframes do). For true layout moves, use framer's `layout`.
- Keep entrances short (≤0.5s) and stagger steps small (≤80ms) — long staggers feel sluggish on a list.
- Mobile-first: test on a phone width; the entrance should not cause horizontal overflow (translateY only).

---

## Adding motion to a new screen — checklist

1. Mapping a list/grid? `const fade = useFadeUp()` + `style={fade(i)}` on each item (forward `style` into card components).
2. Revealing page sections? Wrap each in `<FadeUp index={n}>` (works in server components).
3. Numbers that should count up? `<CountUp value={n} />`.
4. A "win" moment (reward earned)? `celebrate()`.
5. An element that should slide/morph between states? framer `motion` + `layoutId`, and make sure the component stays mounted.
6. Verify with `prefers-reduced-motion: reduce` on — everything should render in place, no animation.
