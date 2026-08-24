import { describe, expect, it } from "vitest";

import { isGsm7, smsSegmentInfo } from "../schemas";

describe("isGsm7", () => {
  it("accepts plain ASCII", () => {
    expect(isGsm7("Hello world")).toBe(true);
  });

  it("accepts GSM-7 extended chars", () => {
    expect(isGsm7("Cost: €5")).toBe(true);
  });

  it("rejects emoji", () => {
    expect(isGsm7("hi 👋")).toBe(false);
  });

  it("rejects Chinese", () => {
    expect(isGsm7("你好")).toBe(false);
  });
});

describe("smsSegmentInfo", () => {
  it("single GSM-7 segment up to 160 chars", () => {
    const info = smsSegmentInfo("a".repeat(160));
    expect(info).toEqual({
      encoding: "GSM-7",
      characters: 160,
      segments: 1,
      maxPerSegment: 160,
    });
  });

  it("two GSM-7 segments past 160 chars", () => {
    const info = smsSegmentInfo("a".repeat(161));
    expect(info.encoding).toBe("GSM-7");
    expect(info.segments).toBe(2);
    expect(info.maxPerSegment).toBe(153);
  });

  it("UCS-2 single segment up to 70 chars", () => {
    const info = smsSegmentInfo("🎉".repeat(35));
    expect(info.encoding).toBe("UCS-2");
    expect(info.segments).toBe(1);
  });

  it("counts GSM-7 extended chars as 2", () => {
    const info = smsSegmentInfo("€");
    expect(info.characters).toBe(2);
  });
});
