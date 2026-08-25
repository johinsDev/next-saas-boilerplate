"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, without breaking hydration.
 *
 * `useSyncExternalStore` rather than `useEffect` + `useState`, and the
 * distinction is the whole point: the third argument is the **server**
 * snapshot, so React renders the same thing on both sides of hydration and
 * then updates. The `useEffect` version renders `false` first on the client
 * too, which is a second render nobody asked for and a visible flash for
 * anything that switches layout on it.
 *
 * Callers should still avoid rendering anything expensive on the first pass:
 * see `ResponsiveModal`, which renders nothing at all while closed, so by the
 * time it opens the real value is known.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    // On the server there is no viewport. `false` means "not the wide layout",
    // so anything built on this falls back to the narrow one — which is the
    // safe direction: a phone layout on a desktop is usable, and the reverse
    // is not.
    () => false,
  );
}

/** Tailwind's `md` breakpoint. Kept here so it is one number, not one per component. */
export const DESKTOP_QUERY = "(min-width: 768px)";
