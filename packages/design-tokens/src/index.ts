/**
 * Design tokens as plain data, for clients that cannot read CSS.
 *
 * `@saas/ui` is web-only: its components are Base UI + Tailwind and its theme
 * is CSS custom properties. React Native has neither, so a native app cannot
 * share the components — but it must share the decisions, or the two clients
 * drift into looking like different products.
 *
 * What is shared is this package. What is NOT shared is components; do not add
 * any here.
 */
export {
  darkColors,
  lightColors,
  type ColorScheme,
  type ColorToken,
} from "./colors";
export { oklchToHex, oklchStringToHex, parseOklch, type Oklch } from "./oklch";

import { darkColors, lightColors, type ColorScheme, type ColorToken } from "./colors";
import { oklchStringToHex } from "./oklch";

/**
 * One theme's tokens as `#rrggbb` (or `#rrggbbaa`), ready for a React Native
 * StyleSheet.
 *
 * Computed rather than stored: a stored hex table would be a second place a
 * colour is written down, and the two would eventually disagree without
 * anything failing. Callers that care should build it once at module scope.
 */
export function colorsAsHex(scheme: ColorScheme): Record<ColorToken, string> {
  const source = scheme === "dark" ? darkColors : lightColors;
  const out = {} as Record<ColorToken, string>;
  for (const [token, value] of Object.entries(source)) {
    out[token as ColorToken] = oklchStringToHex(value);
  }
  return out;
}

/**
 * Corner radius, in px. The stylesheet states `--radius` in rem against a
 * 16px root; React Native has no rem, so the conversion happens here rather
 * than at every call site.
 */
export const radius = {
  base: 14,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 18,
} as const;

/**
 * Font families. Web resolves these through `next/font`, which generates a
 * per-build CSS variable name; a native app loads the same faces by their
 * PostScript-ish family names instead.
 *
 * **These deliberately differ per platform, and that is the point.** Android
 * resolves each weight as its own family, so a single family string plus
 * `fontWeight` silently renders regular everywhere. Web does the opposite.
 * A component library could not paper over this; tokens can state it.
 */
export const fontFamily = {
  web: {
    sans: 'var(--font-inter), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    display: 'var(--font-fraunces), ui-serif, Georgia, serif',
  },
  native: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },
} as const;
