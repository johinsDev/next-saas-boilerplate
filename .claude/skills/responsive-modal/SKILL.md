---
name: responsive-modal
description: Build any overlay (dialog/drawer/sheet/confirm) with ResponsiveModal — one compound component that is a bottom Drawer on mobile and a centered Dialog on desktop. Read before adding or editing any modal in apps/web.
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

# responsive-modal — one overlay, two presentations

`ResponsiveModal` (`@saas/ui`) is the single way to show an overlay in the customer app. It renders a **bottom Drawer (vaul) on mobile** and a **centered medium Dialog (Base UI, `max-w-lg`) on desktop**, behind one compound API — so a screen writes its content once and it looks right on both. **Do not** reach for `Drawer`, `Dialog`, `Sheet`, or `AlertDialog` directly in `apps/web` — they're the building blocks `ResponsiveModal` composes; using them raw reintroduces the mobile-vs-desktop split this component exists to remove.

Source: `packages/ui/src/components/ui/responsive-modal.tsx`. Story: `apps/storybook/stories/responsive-modal.stories.tsx`.

---

## API

| Part | Renders | Notes |
| --- | --- | --- |
| `ResponsiveModal` | Drawer root (mobile) / Dialog root (desktop) | **Controlled only**: `open` + `onOpenChange`. `dismissible?` (mobile swipe/outside-press). |
| `ResponsiveModalContent` | `DrawerContent` / `DialogContent` | `className` (both) · `mobileClassName` · `desktopClassName` · `showCloseButton` (desktop top-right X, default `true`) |
| `ResponsiveModalHeader` | styled `div` | centered on mobile, left-aligned on desktop |
| `ResponsiveModalTitle` / `ResponsiveModalDescription` | Drawer/Dialog title+description | Always include a Title (a11y; Base UI warns without one) |
| `ResponsiveModalFooter` | styled `div` | stacked on mobile, row on desktop |
| `ResponsiveModalClose` | a `Button` | **closes via context**, pre-styled to match the primary action's size (`h-13`) |

```tsx
<ResponsiveModal open={open} onOpenChange={setOpen}>
  <ResponsiveModalContent>
    <ResponsiveModalHeader>
      <ResponsiveModalTitle>Canjear recompensa</ResponsiveModalTitle>
      <ResponsiveModalDescription>5 sellos</ResponsiveModalDescription>
    </ResponsiveModalHeader>

    {/* free content */}

    <ResponsiveModalFooter>
      <ResponsiveModalClose variant="gradient" className="w-full sm:w-auto">
        Canjear
      </ResponsiveModalClose>
      <ResponsiveModalClose className="w-full sm:w-auto">Cerrar</ResponsiveModalClose>
    </ResponsiveModalFooter>
  </ResponsiveModalContent>
</ResponsiveModal>
```

---

## Why `ResponsiveModalClose` closes via context

vaul's `DrawerClose` uses Radix `asChild`; Base UI's `DialogClose` uses `render`. They're incompatible, so a unified close can't wrap either. Instead `ResponsiveModalClose` is a plain `Button` that calls `onOpenChange(false)` from context — works under both primitives **and** standardizes the button. Pass `variant` / `className` to restyle (e.g. `variant="gradient"` for the primary action that also closes). It defaults to `variant="secondary" size="lg"` with `h-13 rounded-full` so **every "Cerrar" matches the primary button's size** — that consistency is a requirement, not a nicety.

For a primary action that should close (Redeem, Add to order, Show at register): use `<ResponsiveModalClose variant="gradient">`. For a primary action that should **navigate** or run a mutation without closing, use a normal `<Button>` and drive `onOpenChange` yourself.

---

## Patterns

**State-driven (the norm).** Every consumer drives the modal from state — a selected id, a `useState`, a nuqs query param, or a zustand store:

```tsx
<ResponsiveModal open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
```

**App-wide drawers** (notifications, QR) are mounted once in the locale layout and opened via a zustand store (`useQrDrawer`, `useNotificationsDrawer`). They still use `ResponsiveModal` internally.

**Custom close affordance** (an ✕ icon in a custom header, like QR/notifications): the component already owns its open state, so the ✕ just calls `setOpen(false)` directly — and set `showCloseButton={false}` so the desktop dialog doesn't render a second X.

**Immersive / full-height content** (the QR code): keep it full-height on mobile, capped on desktop. Read `useIsMobile()` (`@saas/ui`) and apply height conditionally:

```tsx
const isMobile = useIsMobile();
<ResponsiveModalContent
  showCloseButton={false}
  desktopClassName="h-[85dvh]"
  style={{ background: DARK_BG, ...(isMobile ? { height: "92dvh", maxHeight: "92dvh" } : null) }}
>
```

---

## Layout & scrolling

- Desktop content is `flex flex-col max-h-[85dvh] overflow-hidden p-0` (set by the component). Give your content its **own** padding (e.g. an inner `px-6`) and put long content in a `flex-1 overflow-y-auto` region so the footer stays visible — this is why footers used to get cut off.
- Width: desktop is `sm:max-w-lg` by default; for the mobile drawer pass `mobileClassName="mx-auto w-full max-w-md"` to match the app's phone width.
- `ResponsiveModalContent` forwards `aria-describedby={undefined}` etc. — pass it when there's no `ResponsiveModalDescription` to silence the a11y warning.

---

## Migrating a raw Drawer/Dialog (the swap)

1. `Drawer` → `ResponsiveModal`; `DrawerContent` → `ResponsiveModalContent` (move the `mx-auto max-w-md` to `mobileClassName`); `DrawerHeader/Title/Description/Footer` → the `ResponsiveModal*` equivalents.
2. `<DrawerClose asChild><Button>…</Button></DrawerClose>` → `<ResponsiveModalClose>…</ResponsiveModalClose>` (drop the inner Button; pass `variant`/`className` to it instead).
3. A custom ✕ that was a `DrawerClose` → a plain `<button onClick={() => setOpen(false)}>`, and set `showCloseButton={false}`.
4. Typecheck + `oxlint` + `knip` (knip catches the now-unused `Drawer*` imports).

Every customer-app modal already went through this; match the existing ones (rewards, menu, promos, profile, notifications, QR, history) when in doubt.
