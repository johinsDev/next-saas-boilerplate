---
name: zustand
description: Client state management for the next-saas-boilerplate monorepo with Zustand (+ Immer). Use ONLY for state that several components genuinely share — not for local widget state, server data, or URL state. Covers where stores live, the Immer + selector + `useShallow` pattern for performance, typed slices, the Next App Router SSR-safe store-factory gotcha, and devtools/persist. Use when introducing a shared store, refactoring prop-drilling/context into a store, or reviewing a store for re-render/perf issues.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# zustand

Zustand is our **shared client state** tool: reach for it when **multiple, non-adjacent components read and write the same state** and lifting state up / context becomes awkward. It is deliberately **not** the default — most state is something else:

| If the state is… | Use | Not zustand |
| --- | --- | --- |
| Server data (lists, entities, the notifications feed) | `@tanstack/react-query` (via `hc<AppType>` + route handlers) | server state doesn't belong in a store |
| URL/shareable (filters, page, tabs) | `nuqs` | |
| Local to one component / its children | `useState` / `useReducer` | |
| A small generic behavior (debounce, toggle, …) | `ahooks` | |
| **Shared across several components, client-only** | **zustand** | |

So: a cart, a multi-step wizard spanning components, a cross-page UI mode, an editor's selection — yes. A single form's field — no (that's `react-hook-form`/`useState`).

## Where stores live

- **Cross-feature / app-global UI state** → `apps/<app>/src/stores/<name>-store.ts`.
- **Feature-scoped shared state** → `apps/<app>/src/features/<name>/state/<name>-store.ts` (per the `architecture-guard` skill).

A canonical, copy-ready store is in this skill's `references/example-store.ts`.

## The pattern: Immer + narrow selectors

Always create the store with the **Immer** middleware (mutate-style updates, no spread soup) and **co-locate actions** inside the store. Type the whole state+actions shape.

```ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface CartState {
  items: Record<string, number>; // productId -> qty
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  immer((set) => ({
    items: {},
    add: (id) => set((s) => { s.items[id] = (s.items[id] ?? 0) + 1; }),
    remove: (id) => set((s) => { delete s.items[id]; }),
    clear: () => set((s) => { s.items = {}; }),
  })),
);
```

**Consume with narrow selectors — never the whole store.** Selecting the whole object re-renders on every change.

```ts
// ✅ subscribes only to what it needs
const count = useCartStore((s) => Object.keys(s.items).length);
const add = useCartStore((s) => s.add);

// ❌ re-renders on ANY state change
const store = useCartStore();
```

**Selecting multiple values → `useShallow`** so a new object reference doesn't force a re-render:

```ts
import { useShallow } from "zustand/react/shallow";
const { add, clear } = useCartStore(useShallow((s) => ({ add: s.add, clear: s.clear })));
```

Actions have stable identity (they live in the store), so selecting an action alone never re-renders.

## Next.js App Router: SSR-safe stores

A module-level `create(...)` store is a **singleton shared across requests** on the server. That's fine for **client-only UI state** (the common case — the store only ever runs in the browser, mounted under a `"use client"` tree). 

If a store must be **seeded from server data per request** (rare here), do NOT use a module singleton — use the **store-factory + Context provider** pattern (`createStore` + a `<Provider>` that instantiates one store per render) so requests don't bleed into each other. Default to the module store; only reach for the factory when you hydrate from RSC props.

Stores are client state → they only work in `"use client"` components. A server component can't read a store.

## Middleware

- **`immer`** — always (ergonomic nested updates).
- **`devtools`** — wrap in dev for Redux DevTools time-travel: `devtools(immer(...), { name: "cart", enabled: process.env.NODE_ENV !== "production" })`.
- **`persist`** — only when state should survive reloads (localStorage). Set a `name`, and a `partialize` to persist a subset. Beware SSR hydration mismatch — gate UI on a mounted flag.

## Footguns

- **Whole-store selection** → re-render storms. Select slices.
- **Putting server data in zustand** → you reinvent caching/invalidation badly. Keep server data in react-query; the store may hold *derived UI state* about it (e.g. "selected ids"), not the data itself.
- **Big god-store** → split into slices (compose `create` with slice creators) once it grows past one concern.
- **Reading a store in a server component** → it's `undefined`/throws; stores are client-only.

## Common tasks

| Goal | Do |
| --- | --- |
| New shared store | `create<State>()(immer(...))` in `src/stores/` or `features/<x>/state/` |
| Read state without extra re-renders | narrow selector; `useShallow` for object selections |
| Nested update | mutate inside `set((s) => { … })` (Immer) |
| Persist across reloads | `persist` middleware + `partialize` + mounted-gate |
| Seed from server data per request | store-factory + Context provider (not a module singleton) |

## Why this discipline

Zustand is tiny and unopinionated, which makes it easy to misuse — a whole-store hook turns it into a re-render bomb, and stuffing server data in it duplicates react-query badly. The guardrails (use it only for genuinely shared client state, Immer for writes, narrow selectors for reads) are what make it fast and predictable at scale.
