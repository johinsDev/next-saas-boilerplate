/**
 * Colour tokens, mirroring `packages/ui/styles/globals.css`.
 *
 * The stylesheet is the source of truth — it is what the web actually renders
 * and what a designer edits. This file exists because React Native has no CSS
 * custom properties and cannot parse `oklch()`, so a native client needs the
 * same decisions as plain values.
 *
 * Values are kept in their original `oklch()` form rather than as hex, so this
 * file is a transcription and not a translation: `__tests__/sync.test.ts` reads
 * globals.css and fails the moment the two disagree. Hex is derived on demand
 * by `oklchStringToHex`, so no hand-typed hex exists to go stale.
 *
 * Generated from globals.css. Change a colour there, then regenerate.
 */

export const lightColors = {
  "background": "oklch(1 0 0)",
  "foreground": "oklch(0.145 0 0)",
  "card": "oklch(1 0 0)",
  "card-foreground": "oklch(0.145 0 0)",
  "popover": "oklch(1 0 0)",
  "popover-foreground": "oklch(0.145 0 0)",
  "primary": "oklch(0.674 0.115 183.1)",
  "primary-foreground": "oklch(0.985 0 0)",
  "secondary": "oklch(0.97 0 0)",
  "secondary-foreground": "oklch(0.205 0 0)",
  "muted": "oklch(0.97 0 0)",
  "muted-foreground": "oklch(0.556 0 0)",
  "accent": "oklch(0.97 0 0)",
  "accent-foreground": "oklch(0.205 0 0)",
  "destructive": "oklch(0.577 0.245 27.325)",
  "destructive-foreground": "oklch(0.985 0 0)",
  "border": "oklch(0.922 0 0)",
  "input": "oklch(0.922 0 0)",
  "ring": "oklch(0.674 0.115 183.1)",
  "chart-1": "oklch(0.646 0.222 41.116)",
  "chart-2": "oklch(0.6 0.118 184.704)",
  "chart-3": "oklch(0.398 0.07 227.392)",
  "chart-4": "oklch(0.828 0.189 84.429)",
  "chart-5": "oklch(0.769 0.188 70.08)",
  "sidebar": "oklch(0.985 0 0)",
  "sidebar-foreground": "oklch(0.145 0 0)",
  "sidebar-primary": "oklch(0.674 0.115 183.1)",
  "sidebar-primary-foreground": "oklch(0.985 0 0)",
  "sidebar-accent": "oklch(0.97 0 0)",
  "sidebar-accent-foreground": "oklch(0.205 0 0)",
  "sidebar-border": "oklch(0.922 0 0)",
  "sidebar-ring": "oklch(0.674 0.115 183.1)",
} as const;

export const darkColors = {
  "background": "oklch(0.145 0 0)",
  "foreground": "oklch(0.985 0 0)",
  "card": "oklch(0.205 0 0)",
  "card-foreground": "oklch(0.985 0 0)",
  "popover": "oklch(0.205 0 0)",
  "popover-foreground": "oklch(0.985 0 0)",
  "primary": "oklch(0.756 0.125 183.7)",
  "primary-foreground": "oklch(0.145 0 0)",
  "secondary": "oklch(0.269 0 0)",
  "secondary-foreground": "oklch(0.985 0 0)",
  "muted": "oklch(0.269 0 0)",
  "muted-foreground": "oklch(0.708 0 0)",
  "accent": "oklch(0.269 0 0)",
  "accent-foreground": "oklch(0.985 0 0)",
  "destructive": "oklch(0.704 0.191 22.216)",
  "destructive-foreground": "oklch(0.985 0 0)",
  "border": "oklch(1 0 0 / 10%)",
  "input": "oklch(1 0 0 / 15%)",
  "ring": "oklch(0.756 0.125 183.7)",
  "chart-1": "oklch(0.488 0.243 264.376)",
  "chart-2": "oklch(0.696 0.17 162.48)",
  "chart-3": "oklch(0.769 0.188 70.08)",
  "chart-4": "oklch(0.627 0.265 303.9)",
  "chart-5": "oklch(0.645 0.246 16.439)",
  "sidebar": "oklch(0.205 0 0)",
  "sidebar-foreground": "oklch(0.985 0 0)",
  "sidebar-primary": "oklch(0.756 0.125 183.7)",
  "sidebar-primary-foreground": "oklch(0.985 0 0)",
  "sidebar-accent": "oklch(0.269 0 0)",
  "sidebar-accent-foreground": "oklch(0.985 0 0)",
  "sidebar-border": "oklch(1 0 0 / 10%)",
  "sidebar-ring": "oklch(0.756 0.125 183.7)",
} as const;

export type ColorToken = keyof typeof lightColors;
export type ColorScheme = "light" | "dark";
