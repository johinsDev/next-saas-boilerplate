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

## Three edits to reapply after an install

`shadcn add` rewrites files wholesale, so anything we changed inside one comes back. All
three are mechanical; reapply them and re-run `bun run typecheck`.

The first is a portability fix; the other two are upstream bugs, worth reporting back
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

**2. `animated-sidebar.tsx` needs `?.` on its focus-trap calls.** Our tsconfig sets
`noUncheckedIndexedAccess` and beUI's does not, so `focusable[0]` is `T | undefined` there.
The early return above it already proves the list is non-empty; the change only tells the
compiler so. The file carries a comment saying the same thing.

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
