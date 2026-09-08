/**
 * OKLCH → sRGB hex.
 *
 * `packages/ui/styles/globals.css` states every colour in `oklch()`, which is
 * what CSS wants and what React Native cannot parse. Converting here means the
 * stylesheet stays the one place a colour is decided: nothing in this package
 * holds a hex value a human typed, so there is no second list to drift.
 *
 * Reference: Björn Ottosson's Oklab (https://bottosson.github.io/posts/oklab/).
 */

export interface Oklch {
  /** Perceptual lightness, 0–1. */
  readonly l: number;
  /** Chroma, 0–~0.4 in practice. */
  readonly c: number;
  /** Hue in degrees, 0–360. */
  readonly h: number;
  /** 0–1. CSS writes this as a percentage after a slash. */
  readonly alpha: number;
}

const OKLCH_RE =
  /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i;

function toUnit(token: string, percentBase: number): number {
  if (token.endsWith("%")) return Number.parseFloat(token) / 100;
  return Number.parseFloat(token) / percentBase;
}

export function parseOklch(input: string): Oklch {
  const match = OKLCH_RE.exec(input.trim());
  if (!match) throw new Error(`not an oklch() colour: ${input}`);
  const [, rawL, rawC, rawH, rawAlpha] = match;
  return {
    // Lightness is 0–1 unitless, or 0–100%.
    l: toUnit(rawL!, 1),
    // Chroma is unitless, or a percentage of 0.4.
    c: rawC!.endsWith("%")
      ? (Number.parseFloat(rawC!) / 100) * 0.4
      : Number.parseFloat(rawC!),
    h: Number.parseFloat(rawH!),
    alpha: rawAlpha === undefined ? 1 : toUnit(rawAlpha, 1),
  };
}

function linearToSrgb(channel: number): number {
  const v =
    channel <= 0.003_130_8
      ? channel * 12.92
      : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(v * 255)));
}

function toHexPair(value: number): string {
  return value.toString(16).padStart(2, "0");
}

/**
 * Returns `#rrggbb`, or `#rrggbbaa` when the colour is translucent.
 *
 * Out-of-gamut colours are clamped per channel, which is what browsers
 * effectively do too. A token that clamps is a token that was never going to
 * render as written on an sRGB screen.
 */
export function oklchToHex(colour: Oklch): string {
  const hRad = (colour.h * Math.PI) / 180;
  const a = colour.c * Math.cos(hRad);
  const b = colour.c * Math.sin(hRad);

  const lRoot = colour.l + 0.396_337_777_4 * a + 0.215_803_757_3 * b;
  const mRoot = colour.l - 0.105_561_345_8 * a - 0.063_854_172_8 * b;
  const sRoot = colour.l - 0.089_484_177_5 * a - 1.291_485_548 * b;

  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  const r = 4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s;
  const g = -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s;
  const bl = -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s;

  const hex = `#${toHexPair(linearToSrgb(r))}${toHexPair(linearToSrgb(g))}${toHexPair(linearToSrgb(bl))}`;
  if (colour.alpha >= 1) return hex;
  return `${hex}${toHexPair(Math.round(colour.alpha * 255))}`;
}

/** Convenience: `oklch(…)` string straight to hex. */
export function oklchStringToHex(input: string): string {
  return oklchToHex(parseOklch(input));
}
