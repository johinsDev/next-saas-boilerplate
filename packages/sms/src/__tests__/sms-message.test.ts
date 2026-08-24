import { describe, expect, it } from "vitest";

import { InvalidMessageError, InvalidPhoneNumberError } from "../errors";
import { SmsMessage } from "../sms-message";

describe("SmsMessage", () => {
  it("compiles a plain message", () => {
    const data = new SmsMessage()
      .to("+5491155555555")
      .content("Hola Lucía")
      .toData();

    expect(data).toEqual({
      to: "+5491155555555",
      content: "Hola Lucía",
    });
  });

  it("concatenates multiple content parts", () => {
    const data = new SmsMessage()
      .to("+5491155555555")
      .content("Hola ")
      .content("Lucía")
      .line()
      .content("Tu código es 1234")
      .toData();
    expect(data.content).toBe("Hola Lucía\nTu código es 1234");
  });

  it("includes from when set", () => {
    const data = new SmsMessage()
      .to("+5491155555555")
      .from("+5491100000000")
      .content("hi")
      .toData();
    expect(data.from).toBe("+5491100000000");
  });

  it("throws when recipient missing", () => {
    expect(() => new SmsMessage().content("hi").toData()).toThrow(
      InvalidMessageError,
    );
  });

  it("throws when content missing", () => {
    expect(() => new SmsMessage().to("+5491155555555").toData()).toThrow(
      InvalidMessageError,
    );
  });

  it("throws on invalid phone", () => {
    expect(() => new SmsMessage().to("123")).toThrow(InvalidPhoneNumberError);
  });

  it("rejects content over 1600 chars", () => {
    const tooLong = "a".repeat(1601);
    expect(() =>
      new SmsMessage().to("+5491155555555").content(tooLong).toData(),
    ).toThrow(InvalidMessageError);
  });

  it("exposes segment info for current content (GSM-7 single)", () => {
    const m = new SmsMessage().to("+5491155555555").content("Hola");
    expect(m.segmentInfo).toEqual({
      encoding: "GSM-7",
      characters: 4,
      segments: 1,
      maxPerSegment: 160,
    });
  });

  it("returns null segmentInfo when no content set", () => {
    const m = new SmsMessage().to("+5491155555555");
    expect(m.segmentInfo).toBeNull();
  });

  it("counts UCS-2 segmentation for emoji", () => {
    const m = new SmsMessage().to("+5491155555555").content("🎉");
    expect(m.segmentInfo?.encoding).toBe("UCS-2");
  });
});
