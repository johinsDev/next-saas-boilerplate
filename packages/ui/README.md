# @saas/ui

The shared component kit. Two families live here, and they coexist on purpose:

- **Ours**, in `src/components/ui/` — built on Base UI, installed and styled through
  `components.json`.
- **beUI**, in `src/components/motion/` — animated components over `motion/react`. They
  carry no primitive library of their own, so they sit beside Base UI rather than dragging
  in a second one, and they expect shadcn's token names, which `styles/globals.css`
  already uses.

## Installing a beUI component

```bash
cd packages/ui
bunx --bun shadcn@latest add @beui/<name>
```

The registry is declared in `components.json`.

## Edits to reapply after an install

`shadcn add` rewrites files wholesale, so anything we changed inside one comes back. All
are mechanical; reapply them and re-run `bun run typecheck`.

The first is a portability fix; the rest are upstream mismatches, worth reporting back
rather than carrying forever.

**1. Imports must be relative, and `cn` comes from `src/cn.ts`.** This package ships raw
TypeScript, so each consuming app compiles these files itself — and `@/` there resolves
against *the app's* paths, not ours. The build fails with `Cannot find module '@/lib/utils'`
even though it typechecks fine here. The install also writes a second `cn` to
`src/lib/utils.ts`; delete it, because this kit already has one.

```bash
# from the repo root
python3 - <<'PY'
import os, re, io
root = "packages/ui/src"
for dirpath, _, files in os.walk(os.path.join(root, "components", "motion")):
    for f in files:
        if not f.endswith((".ts", ".tsx")): continue
        p = os.path.join(dirpath, f)
        s = io.open(p, encoding="utf-8").read()
        up = "/".join([".."] * len(os.path.relpath(dirpath, root).split(os.sep)))
        s = s.replace('"@/lib/utils"', f'"{up}/cn"')
        io.open(p, "w", encoding="utf-8").write(re.sub(r'"@/([^"]+)"', lambda m: f'"{up}/{m.group(1)}"', s))
PY
rm -f packages/ui/src/lib/utils.ts
```

**2. Indexed access needs a guard.** Our tsconfig sets `noUncheckedIndexedAccess` and
beUI's does not, so `array[i]` is `T | undefined` here and not there. Two files carry it
today: `animated-sidebar.tsx` (the focus trap — `focusable[0]`, where the early return
above already proves the list is non-empty) and `bottom-sheet.tsx` (snap points, where
`snap` is an index every path clamps to the array). Both changes only tell the compiler
what the surrounding code already proves. Read the comment at each site before changing a
fallback: picking the wrong one turns a type error into a silent behaviour change.

**3. `animated-sidebar.tsx` needs its `linkAs` prop back.** This is the one that matters.
beUI is framework-agnostic, so `href` renders a plain `<a>` — a full page load, which
silently costs client-side navigation, the prefetch `partialPrefetching` sets up, and every
provider's state above it (the sidebar springs back open on every click, which is how it
was noticed). Both the menu button and the sub-button take `linkAs`; a Next app passes
`next/link`:

```tsx
// Module scope. `motion.create` returns a new component type on every call, and a
// new type makes React unmount and remount the whole subtree each render.
const MotionLink = motion.create(Link);

<AnimatedSidebarMenuButton href={href} linkAs={MotionLink} … />
```

Lint exemptions for these files live in the root `.oxlintrc.json`, in config rather than in
disable comments, precisely so an overwrite cannot drop them.

## Before you "fix" an animation

Read the debugging section of `.claude/skills/ui-motion`. Two things make the browser lie:
Strict Mode double-invokes effects in development and not in production, and a backgrounded
tab freezes `requestAnimationFrame` — which both stops motion entirely and makes any
in-page timing measurement quietly wrong.

## Overlays, and which one to reach for

Three pieces sit on top of beUI rather than inside it, because beUI ships the parts and
not the policy:

- **`ToastProvider` / `useToast`.** beUI's `useAnimatedToastStack` is local state, which is
  right for a demo and wrong for an app: a toast raised by a menu has to outlive the menu
  that raised it, and two components each holding a stack would pile their toasts into the
  same corner. The provider is mounted once per app, portalled and fixed so no overflow
  container clips it.

  **`components/ui/sonner.tsx` is still in the tree and unused.** Do not wire it up as
  well.

- **`ResponsiveModal`.** This kit's `Dialog` on a desktop, beUI's `BottomSheet` on a phone.
  Two components rather than one restyled: a centred box on a phone puts a form half behind
  the keyboard with nowhere to scroll. It renders nothing while closed, which is also what
  makes `useMediaQuery` safe across hydration — by the time anybody opens it, the client
  knows the real viewport.

- **`useMediaQuery`.** `useSyncExternalStore`, so the server and the first client render
  agree. `useIsMobile` in `src/hooks/` is the older `useEffect` version and renders `false`
  once before correcting itself; prefer this one for anything that switches layout.

`MotionSelect` and `MotionPopover` are beUI's, prefixed because every part of them would
otherwise collide with the kit's own `Select` and `Popover` — which stay the ones to reach
for in a dense form or for a plain anchored panel. The beUI versions melt out of their
trigger, which is worth the swap where the gesture is part of the point: an account menu, a
quick-actions panel.

`ThemeChoice` is three positions — system, light, dark — where beUI's `ThemeToggle` is two.
The toggle is the right control for a rail and the wrong one for a menu: it cannot express
"follow the system", so somebody who has never touched it is shown a state they did not
choose and cannot get back to. It keeps the View Transition; the circular reveal belongs to
`ThemeToggle`'s own two-state toggle and stays there.
