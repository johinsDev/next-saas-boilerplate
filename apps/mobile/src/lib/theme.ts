import { colorsAsHex, radius } from "@saas/design-tokens";

/**
 * The app's palette, computed once at module scope.
 *
 * `@saas/ui` cannot come along — it is Base UI and Tailwind, neither of which
 * exists here — but the decisions can, and `@saas/design-tokens` is where they
 * live. React Native cannot parse `oklch()`, so the tokens are converted to hex
 * on the way in.
 */
export const themes = {
  light: colorsAsHex("light"),
  dark: colorsAsHex("dark"),
} as const;

/**
 * Takes a plain string, not `ColorScheme`, because React Native's
 * `useColorScheme()` also returns `"unspecified"` — an OS-level "no preference"
 * that is not a theme. Anything that is not explicitly dark falls to light,
 * which is the safe default: a light UI on a device that wanted dark is
 * readable, the reverse is not always.
 */
export function theme(scheme: string | null | undefined) {
  return themes[scheme === "dark" ? "dark" : "light"];
}

export { radius };
