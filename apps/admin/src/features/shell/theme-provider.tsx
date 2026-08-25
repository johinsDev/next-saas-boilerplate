"use client";

import { ThemeProvider as NextThemes } from "next-themes";
import type { ReactNode } from "react";

/**
 * Light and dark, remembered.
 *
 * `attribute="class"` is not a default worth guessing at — it must match what
 * the kit's stylesheet keys off, and `packages/ui/styles/globals.css` declares
 * its dark palette under `.dark`. Get it wrong and the toggle flips, stores the
 * preference, and changes nothing on screen: a bug that reads as a broken
 * toggle rather than as a one-word config mismatch.
 *
 * `disableTransitionOnChange` because beUI's toggle does the transition itself
 * — a circular reveal growing from the control you pressed. Letting CSS
 * cross-fade every colour at the same time fights it and looks like a smear.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
