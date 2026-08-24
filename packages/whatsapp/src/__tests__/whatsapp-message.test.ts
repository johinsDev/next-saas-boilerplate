import { describe, expect, it } from "vitest";
import {
  InvalidMessageError,
  InvalidPhoneNumberError,
} from "../errors";
import { WhatsAppMessage } from "../whatsapp-message";

describe("WhatsAppMessage", () => {
  it("compiles a freeform message with formatting parts", () => {
    const data = new WhatsAppMessage()
      .to("+5491155555555")
      .content("Hola ")
      .bold("Lucía")
      .content("!")
      .toData();

    expect(data).toEqual({
      to: "+5491155555555",
      content: "Hola *Lucía*!",
    });
  });

  it("includes from when set", () => {
    const data = new WhatsAppMessage()
      .to("+5491155555555")
      .from("+5491100000000")
      .content("hi")
      .toData();
    expect(data.from).toBe("+5491100000000");
  });

  it("attaches media url", () => {
    const data = new WhatsAppMessage()
      .to("+5491155555555")
      .content("look")
      .media("https://example.com/img.png")
      .toData();
    expect(data.mediaUrl).toBe("https://example.com/img.png");
  });

  it("template mode wins over freeform content", () => {
    const data = new WhatsAppMessage()
      .to("+5491155555555")
      .template("HX0000", { "1": "Lucía", "2": "10" })
      .toData();
    expect(data.contentSid).toBe("HX0000");
    expect(data.contentVariables).toEqual({ "1": "Lucía", "2": "10" });
    expect(data.content).toBe("[Content Template]");
  });

  it("appends emoji from registered map", () => {
    const data = new WhatsAppMessage()
      .to("+5491155555555")
      .emoji("tea")
      .content(" rica")
      .toData();
    expect(data.content).toBe("🍵 rica");
  });

  it("throws on unknown emoji", () => {
    expect(() =>
      new WhatsAppMessage().to("+5491155555555").emoji("nope").toData(),
    ).toThrow(InvalidMessageError);
  });

  it("throws when recipient missing", () => {
    expect(() => new WhatsAppMessage().content("hi").toData()).toThrow(
      InvalidMessageError,
    );
  });

  it("throws on invalid phone", () => {
    expect(() => new WhatsAppMessage().to("123")).toThrow(
      InvalidPhoneNumberError,
    );
  });

  it("throws when content and media both missing", () => {
    expect(() => new WhatsAppMessage().to("+5491155555555").toData()).toThrow(
      InvalidMessageError,
    );
  });

  it("allows media-only message", () => {
    const data = new WhatsAppMessage()
      .to("+5491155555555")
      .media("https://example.com/img.png")
      .toData();
    expect(data.content).toBe("");
    expect(data.mediaUrl).toBe("https://example.com/img.png");
  });
});
