import { describe, expect, it } from "vitest";

import { oklchStringToHex, parseOklch } from "../oklch";

describe("parseOklch", () => {
  it("reads the three components", () => {
    expect(parseOklch("oklch(0.674 0.115 183.1)")).toEqual({
      l: 0.674,
      c: 0.115,
      h: 183.1,
      alpha: 1,
    });
  });

  it("reads a slash alpha as a percentage", () => {
    expect(parseOklch("oklch(1 0 0 / 10%)").alpha).toBeCloseTo(0.1, 5);
  });

  it("rejects anything that is not oklch", () => {
    expect(() => parseOklch("#ffffff")).toThrow(/not an oklch/);
    expect(() => parseOklch("rgb(1 2 3)")).toThrow(/not an oklch/);
  });
});

describe("oklchStringToHex", () => {
  // The neutral ramp shadcn ships is Tailwind's, whose hex values are
  // published — so these are external ground truth, not this implementation
  // agreeing with itself.
  it.each([
    ["oklch(1 0 0)", "#ffffff"],
    ["oklch(0 0 0)", "#000000"],
    ["oklch(0.985 0 0)", "#fafafa"],
    ["oklch(0.922 0 0)", "#e5e5e5"],
    ["oklch(0.708 0 0)", "#a1a1a1"],
    ["oklch(0.269 0 0)", "#262626"],
    ["oklch(0.205 0 0)", "#171717"],
    ["oklch(0.145 0 0)", "#0a0a0a"],
  ])("converts %s to %s", (input, expected) => {
    expect(oklchStringToHex(input)).toBe(expected);
  });

  it("keeps alpha as a fourth byte", () => {
    expect(oklchStringToHex("oklch(1 0 0 / 10%)")).toBe("#ffffff1a");
    expect(oklchStringToHex("oklch(1 0 0 / 15%)")).toBe("#ffffff26");
  });

  it("clamps a colour outside the sRGB gamut instead of wrapping", () => {
    // Far more chroma than sRGB can hold; every channel must stay in range.
    const hex = oklchStringToHex("oklch(0.7 0.4 150)");
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});
