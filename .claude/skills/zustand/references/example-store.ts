// Canonical shared-store example for the next-saas-boilerplate monorepo.
// Copy into `apps/<app>/src/stores/<name>-store.ts` (or a feature's
// `state/` folder) and adapt. Demonstrates: Immer writes, co-located
// actions, devtools in dev, narrow selectors, and `useShallow`.
//
// This file lives under .claude/skills/ (not app src) on purpose — it's
// reference material, not shipped code.

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { useShallow } from "zustand/react/shallow";

interface CartState {
  items: Record<string, number>; // productId -> qty
  add: (productId: string) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  devtools(
    immer((set) => ({
      items: {},
      add: (productId) =>
        set((s) => {
          s.items[productId] = (s.items[productId] ?? 0) + 1;
        }),
      remove: (productId) =>
        set((s) => {
          delete s.items[productId];
        }),
      setQty: (productId, qty) =>
        set((s) => {
          if (qty <= 0) delete s.items[productId];
          else s.items[productId] = qty;
        }),
      clear: () =>
        set((s) => {
          s.items = {};
        }),
    })),
    { name: "cart", enabled: process.env.NODE_ENV !== "production" },
  ),
);

// --- Consuming with narrow selectors ------------------------------------

// Single derived value — re-renders only when the count changes.
export const useCartCount = () =>
  useCartStore((s) => Object.values(s.items).reduce((a, b) => a + b, 0));

// Multiple values/actions — `useShallow` avoids a new-object re-render.
export const useCartActions = () =>
  useCartStore(
    useShallow((s) => ({ add: s.add, remove: s.remove, clear: s.clear })),
  );
