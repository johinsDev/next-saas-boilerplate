import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { darkColors, lightColors } from "../colors";

/**
 * The one thing this package must never do is disagree with the stylesheet.
 *
 * Nothing at runtime compares them: the web reads globals.css, a native client
 * reads this package, and neither ever sees the other. So a colour changed in
 * one place produces two products that look subtly different, with no error
 * anywhere. This test is the comparison.
 */
function tokensFrom(selector: string): Record<string, string> {
  const css = readFileSync(
    new URL("../../../ui/styles/globals.css", import.meta.url),
    "utf8",
  );
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(css);
  if (!block) throw new Error(`no ${selector} block in globals.css`);

  const out: Record<string, string> = {};
  for (const [, name, value] of block[1]!.matchAll(
    /--([a-z0-9-]+):\s*([^;]+);/g,
  )) {
    const trimmed = value!.trim();
    if (trimmed.startsWith("oklch(")) out[name!] = trimmed;
  }
  return out;
}

describe("colour tokens mirror packages/ui/styles/globals.css", () => {
  it("matches the light theme", () => {
    expect(lightColors).toEqual(tokensFrom(":root"));
  });

  it("matches the dark theme", () => {
    expect(darkColors).toEqual(tokensFrom(".dark"));
  });

  it("defines every token in both themes", () => {
    expect(Object.keys(darkColors).sort()).toEqual(
      Object.keys(lightColors).sort(),
    );
  });
});
