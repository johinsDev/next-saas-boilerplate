import { describe, expect, it, vi } from "vitest";

import { SubscriptionExpiredError } from "../errors";
import { AutoPushSender } from "../sender";
import type {
  PushMessageData,
  PushResponse,
  PushTransport,
  ResolvedRecipient,
} from "../types";

function stubTransport(
  name: string,
  impl?: (
    msg: PushMessageData,
    r: ResolvedRecipient,
  ) => Promise<PushResponse>,
): PushTransport {
  return {
    name,
    send:
      impl ??
      (async (_msg, r) => ({
        status: "sent",
        provider: name,
        platform: r.platform,
        token: r.token,
        providerMessageId: `${name}-fake`,
        timestamp: new Date().toISOString(),
      })),
  };
}

describe("AutoPushSender", () => {
  it("fans out a user-recipient to webpush + expo tokens", async () => {
    const webpush = stubTransport("webpush");
    const expo = stubTransport("expo");
    const sender = new AutoPushSender(
      "auto",
      { webpush, expo },
      {
        logLevel: "silent",
        tokenLookup: async () => [
          { token: JSON.stringify({ endpoint: "https://x", keys: { p256dh: "p", auth: "a" } }), platform: "webpush" },
          { token: "ExponentPushToken[abc]", platform: "expo" },
        ],
      },
    );
    const responses = await sender.sendCompiled({
      recipients: [{ kind: "user", userId: "u_1" }],
      title: "Hi",
      body: "Body",
    });
    expect(responses).toHaveLength(2);
    expect(responses.map((r) => r.provider).sort()).toEqual(["expo", "webpush"]);
  });

  it("returns an empty array when the user has no tokens", async () => {
    const sender = new AutoPushSender(
      "auto",
      { webpush: stubTransport("webpush"), expo: stubTransport("expo") },
      { logLevel: "silent", tokenLookup: async () => [] },
    );
    const responses = await sender.sendCompiled({
      recipients: [{ kind: "user", userId: "u_1" }],
      title: "Hi",
      body: "Body",
    });
    expect(responses).toHaveLength(0);
  });

  it("normalizes SubscriptionExpiredError into status: 'expired'", async () => {
    const expo = stubTransport("expo", async () => {
      throw new SubscriptionExpiredError("ExponentPushToken[gone]");
    });
    const sender = new AutoPushSender(
      "auto",
      { webpush: stubTransport("webpush"), expo },
      {
        logLevel: "silent",
        tokenLookup: async () => [],
      },
    );
    const responses = await sender.sendCompiled({
      recipients: [
        { kind: "token", token: "ExponentPushToken[gone]", platform: "expo" },
      ],
      title: "Hi",
      body: "Body",
    });
    expect(responses).toHaveLength(1);
    expect(responses[0]?.status).toBe("expired");
  });

  it("routes a token-recipient to the matching platform transport", async () => {
    const webpush = stubTransport("webpush");
    const expo = stubTransport("expo");
    const webpushSend = vi.spyOn(webpush, "send");
    const expoSend = vi.spyOn(expo, "send");
    const sender = new AutoPushSender(
      "auto",
      { webpush, expo },
      { logLevel: "silent", tokenLookup: async () => [] },
    );
    await sender.sendCompiled({
      recipients: [
        { kind: "token", token: "ExponentPushToken[a]", platform: "expo" },
      ],
      title: "Hi",
      body: "Body",
    });
    expect(expoSend).toHaveBeenCalledOnce();
    expect(webpushSend).not.toHaveBeenCalled();
  });

  it("rethrows non-expired errors", async () => {
    const expo = stubTransport("expo", async () => {
      throw new Error("boom");
    });
    const sender = new AutoPushSender(
      "auto",
      { webpush: stubTransport("webpush"), expo },
      { logLevel: "silent", tokenLookup: async () => [] },
    );
    await expect(
      sender.sendCompiled({
        recipients: [
          { kind: "token", token: "ExponentPushToken[a]", platform: "expo" },
        ],
        title: "Hi",
        body: "Body",
      }),
    ).rejects.toThrow(/boom/);
  });
});
