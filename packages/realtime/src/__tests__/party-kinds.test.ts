import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PARTY_KINDS } from "../types";

/**
 * A room's kind becomes the party name in the URL the publisher and the socket
 * both build (`/parties/<kind>/<body>`). Nothing at runtime compares this list
 * against the parties PartyKit actually serves, so a mismatch is invisible:
 * the publish 404s and the socket never opens, with no error that names the
 * cause. This test is the comparison.
 *
 * It once mattered — the union shipped as `customer` / `org` / `chat` while
 * partykit.json declared `user` and `organization`, so every room routed
 * nowhere.
 */
describe("party kinds", () => {
  it("matches the parties declared in partykit.json", () => {
    const configUrl = new URL(
      "../../../../partykit/partykit.json",
      import.meta.url,
    );
    const config = JSON.parse(readFileSync(configUrl, "utf8")) as {
      parties?: Record<string, string>;
    };
    const declared = Object.keys(config.parties ?? {}).sort();

    expect(declared).toEqual([...PARTY_KINDS].sort());
  });
});
