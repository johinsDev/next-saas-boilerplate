import { describe, expect, it } from "vitest";

import { parseRoom, PARTY_KINDS } from "../types";

describe("parseRoom", () => {
  it("splits a user room", () => {
    expect(parseRoom("user:u_abc")).toEqual({ kind: "user", body: "u_abc" });
  });

  it("splits an organization room", () => {
    expect(parseRoom("organization:o_xyz")).toEqual({
      kind: "organization",
      body: "o_xyz",
    });
  });

  it("keeps colons in the body", () => {
    expect(parseRoom("user:u:weird-id" as never)).toEqual({
      kind: "user",
      body: "u:weird-id",
    });
  });

  it("rejects an empty body", () => {
    expect(() => parseRoom("user:" as never)).toThrow(/empty room body/);
  });

  it("rejects a name with no separator", () => {
    expect(() => parseRoom("invalid" as never)).toThrow(/invalid room name/);
  });

  // `roomId` arrives as a plain string on the wire (it comes back inside a
  // ticket), so the template-literal type does not protect this path. Without
  // the check the client builds `/parties/customer/<id>`, PartyKit answers 404,
  // and the only symptom is a socket that never opens.
  it("rejects a kind that has no party", () => {
    expect(() => parseRoom("customer:c_abc" as never)).toThrow(
      /unknown party kind "customer"/,
    );
    expect(() => parseRoom("org:o_abc" as never)).toThrow(
      /unknown party kind "org"/,
    );
  });

  it("accepts every declared kind", () => {
    for (const kind of PARTY_KINDS) {
      expect(parseRoom(`${kind}:x` as never)).toEqual({ kind, body: "x" });
    }
  });
});
