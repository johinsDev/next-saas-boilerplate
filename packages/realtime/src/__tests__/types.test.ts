import { describe, expect, it } from "vitest";

import { parseRoom } from "../types";

describe("parseRoom", () => {
  it("parses customer rooms", () => {
    expect(parseRoom("customer:c_abc")).toEqual({ kind: "customer", body: "c_abc" });
  });

  it("parses org rooms", () => {
    expect(parseRoom("org:o_xyz")).toEqual({ kind: "org", body: "o_xyz" });
  });

  it("parses chat rooms", () => {
    expect(parseRoom("chat:c_123")).toEqual({ kind: "chat", body: "c_123" });
  });

  it("preserves uuids with extra colons in the body", () => {
    expect(parseRoom("customer:c:weird-id" as never)).toEqual({
      kind: "customer",
      body: "c:weird-id",
    });
  });

  it("throws when body is empty", () => {
    expect(() => parseRoom("customer:" as never)).toThrow(/empty room body/);
  });

  it("throws when there's no separator", () => {
    expect(() => parseRoom("invalid" as never)).toThrow(/invalid room name/);
  });
});
