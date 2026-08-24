import { describe, expect, it } from "vitest";

import { InvalidEmailError, InvalidMessageError } from "../errors";
import { EmailMessage } from "../email-message";

describe("EmailMessage", () => {
  it("compiles a plain text+html message", () => {
    const data = new EmailMessage()
      .to("lucia@example.com")
      .from("notifications@acme.app")
      .subject("Hola")
      .html("<p>Hola</p>")
      .text("Hola")
      .toData();

    expect(data).toEqual({
      to: ["lucia@example.com"],
      from: "notifications@acme.app",
      subject: "Hola",
      html: "<p>Hola</p>",
      text: "Hola",
    });
  });

  it("supports recipient with name", () => {
    const data = new EmailMessage()
      .to("lucia@example.com", "Lucía")
      .from({ address: "notifications@acme.app", name: "Acme" })
      .subject("Hola")
      .html("<p>Hi</p>")
      .toData();

    expect(data.to).toEqual([{ address: "lucia@example.com", name: "Lucía" }]);
    expect(data.from).toEqual({ address: "notifications@acme.app", name: "Acme" });
  });

  it("accepts multiple recipients", () => {
    const data = new EmailMessage()
      .to("a@example.com")
      .to("b@example.com", "B")
      .subject("hi")
      .html("<p>hi</p>")
      .toData();
    expect(data.to).toHaveLength(2);
  });

  it("supports cc, bcc, replyTo", () => {
    const data = new EmailMessage()
      .to("a@example.com")
      .cc("c@example.com")
      .bcc("b@example.com")
      .replyTo("reply@example.com")
      .subject("hi")
      .text("hi")
      .toData();
    expect(data.cc).toEqual(["c@example.com"]);
    expect(data.bcc).toEqual(["b@example.com"]);
    expect(data.replyTo).toBe("reply@example.com");
  });

  it("supports headers, tags, priority", () => {
    const data = new EmailMessage()
      .to("a@example.com")
      .subject("hi")
      .text("hi")
      .header("X-Campaign", "welcome")
      .tag("kind", "welcome")
      .priority("high")
      .toData();
    expect(data.headers).toEqual({ "X-Campaign": "welcome" });
    expect(data.tags).toEqual([{ name: "kind", value: "welcome" }]);
    expect(data.priority).toBe("high");
  });

  it("supports attachments", () => {
    const data = new EmailMessage()
      .to("a@example.com")
      .subject("hi")
      .text("hi")
      .attach({ filename: "card.pdf", content: "base64data", contentType: "application/pdf" })
      .toData();
    expect(data.attachments).toHaveLength(1);
    expect(data.attachments?.[0]?.filename).toBe("card.pdf");
  });

  it("throws when no recipient", () => {
    expect(() => new EmailMessage().subject("hi").text("hi").toData()).toThrow(
      InvalidMessageError,
    );
  });

  it("throws when no subject", () => {
    expect(() =>
      new EmailMessage().to("a@example.com").text("hi").toData(),
    ).toThrow(InvalidMessageError);
  });

  it("throws when no body", () => {
    expect(() =>
      new EmailMessage().to("a@example.com").subject("hi").toData(),
    ).toThrow(InvalidMessageError);
  });

  it("throws on invalid email", () => {
    expect(() => new EmailMessage().to("not-an-email")).toThrow(
      InvalidEmailError,
    );
  });

  it("throws on subject over 998 chars", () => {
    const tooLong = "x".repeat(999);
    expect(() =>
      new EmailMessage().to("a@example.com").subject(tooLong).text("hi").toData(),
    ).toThrow(InvalidMessageError);
  });

  it("allows html-only or text-only body", () => {
    const htmlOnly = new EmailMessage()
      .to("a@example.com")
      .subject("hi")
      .html("<p>hi</p>")
      .toData();
    expect(htmlOnly.text).toBeUndefined();

    const textOnly = new EmailMessage()
      .to("a@example.com")
      .subject("hi")
      .text("hi")
      .toData();
    expect(textOnly.html).toBeUndefined();
  });
});
