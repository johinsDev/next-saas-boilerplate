import { describe, expect, it } from "vitest";

import { colorsAsHex, fontFamily, lightColors } from "../index";

describe("colorsAsHex", () => {
  it("converts every token", () => {
    const hex = colorsAsHex("light");
    expect(Object.keys(hex).sort()).toEqual(Object.keys(lightColors).sort());
    for (const value of Object.values(hex)) {
      expect(value).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
    }
  });

  it("gives the two schemes different backgrounds", () => {
    expect(colorsAsHex("light").background).not.toBe(
      colorsAsHex("dark").background,
    );
  });
});

describe("fontFamily", () => {
  // Android resolves each weight as a separate family, so a native client that
  // reached for the web's single family string plus fontWeight would render
  // regular at every weight — silently. Pinning the shape keeps the difference
  // from being "tidied up" later.
  it("keeps per-weight families for native", () => {
    expect(Object.keys(fontFamily.native)).toEqual([
      "regular",
      "medium",
      "semibold",
      "bold",
    ]);
    expect(fontFamily.web.sans).toContain("var(--font-");
  });
});
