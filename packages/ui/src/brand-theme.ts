// Per-tenant theming: a brand hex drives the primary/ring tokens (and their
// sidebar twins) on `:root` + `.dark`. Tailwind v4 tokens are plain CSS vars, so
// setting `--primary` to a hex works everywhere (`bg-primary`, `from-primary`,
// `primary/10` color-mix, focus `--ring`). Only the foreground needs computing —
// black or white by relative luminance for legible text on the brand color.

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Relative luminance (sRGB) of a `#rrggbb` hex, 0..1. */
function luminance(hex: string): number {
  const m = hex.slice(1);
  const ch = (i: number) => parseInt(m.slice(i, i + 2), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(ch(0)) + 0.7152 * lin(ch(2)) + 0.0722 * lin(ch(4));
}

/** Black or white — whichever is legible on `hex`. */
export function brandForeground(hex: string): string {
  return luminance(hex) > 0.45 ? "#0a0a0a" : "#ffffff";
}

/**
 * Inline CSS that re-themes the app from a brand color. Returns "" for an
 * invalid/empty hex (no-op → the default teal tokens stand). Inject the result
 * into a `<style>` at SSR (after the global stylesheet) so it wins the cascade.
 */
export function brandThemeCss(hex: string | null | undefined): string {
  if (!hex || !HEX.test(hex)) return "";
  const fg = brandForeground(hex);
  const vars =
    `--primary:${hex};--ring:${hex};--primary-foreground:${fg};` +
    `--sidebar-primary:${hex};--sidebar-ring:${hex};--sidebar-primary-foreground:${fg};`;
  return `:root{${vars}}.dark{${vars}}`;
}
