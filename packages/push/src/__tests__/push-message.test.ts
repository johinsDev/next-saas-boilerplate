import { describe, expect, it } from "vitest";

import { InvalidMessageError, InvalidTokenError } from "../errors";
import { PushMessage } from "../push-message";
import { fakeWebPushSubscription } from "../factories";

describe("PushMessage", () => {
  it("builds with a token recipient", () => {
    const data = new PushMessage()
      .toToken("ExponentPushToken[abc-123]", "expo")
      .title("Hi")
      .body("Body")
      .toData();
    expect(data.recipients).toEqual([
      { kind: "token", token: "ExponentPushToken[abc-123]", platform: "expo" },
    ]);
    expect(data.title).toBe("Hi");
    expect(data.body).toBe("Body");
  });

  it("builds with a user recipient", () => {
    const data = new PushMessage()
      .toUser("u_123")
      .title("Hi")
      .body("Body")
      .toData();
    expect(data.recipients).toEqual([{ kind: "user", userId: "u_123" }]);
  });

  it("accepts a webpush JSON token", () => {
    const sub = JSON.stringify(fakeWebPushSubscription());
    const data = new PushMessage()
      .toToken(sub, "webpush")
      .title("Hi")
      .body("Body")
      .toData();
    expect(data.recipients[0]?.kind).toBe("token");
  });

  it("rejects an invalid Expo token", () => {
    expect(() =>
      new PushMessage().toToken("not-an-expo-token", "expo"),
    ).toThrow(InvalidTokenError);
  });

  it("rejects a non-JSON webpush token", () => {
    expect(() => new PushMessage().toToken("not-json", "webpush")).toThrow(
      InvalidTokenError,
    );
  });

  it("rejects a webpush JSON missing required keys", () => {
    expect(() =>
      new PushMessage().toToken(JSON.stringify({ endpoint: "http://x" }), "webpush"),
    ).toThrow(InvalidTokenError);
  });

  it("throws when no recipient is set", () => {
    expect(() => new PushMessage().title("Hi").body("Body").toData()).toThrow(
      InvalidMessageError,
    );
  });

  it("throws when title is missing", () => {
    expect(() =>
      new PushMessage().toUser("u_1").body("Body").toData(),
    ).toThrow(InvalidMessageError);
  });

  it("throws when body is missing", () => {
    expect(() =>
      new PushMessage().toUser("u_1").title("Hi").toData(),
    ).toThrow(InvalidMessageError);
  });

  it("throws when title is too long", () => {
    expect(() => new PushMessage().title("x".repeat(121))).toThrow(
      InvalidMessageError,
    );
  });

  it("accumulates multiple recipients", () => {
    const data = new PushMessage()
      .toToken("ExponentPushToken[a]", "expo")
      .toToken("ExponentPushToken[b]", "expo")
      .toUser("u_3")
      .title("Hi")
      .body("Body")
      .toData();
    expect(data.recipients).toHaveLength(3);
  });

  it("merges data() calls", () => {
    const data = new PushMessage()
      .toUser("u_1")
      .title("Hi")
      .body("Body")
      .data({ a: 1 })
      .data({ b: 2 })
      .toData();
    expect(data.data).toEqual({ a: 1, b: 2 });
  });

  it("carries badge/icon/image/clickAction/ttl/priority through", () => {
    const data = new PushMessage()
      .toUser("u_1")
      .title("Hi")
      .body("Body")
      .badge(3)
      .icon("/icon.png")
      .image("/banner.jpg")
      .clickAction("/card")
      .ttl(120)
      .priority("high")
      .sound("default")
      .toData();
    expect(data).toMatchObject({
      badge: 3,
      icon: "/icon.png",
      image: "/banner.jpg",
      clickAction: "/card",
      ttl: 120,
      priority: "high",
      sound: "default",
    });
  });
});
