import type { WebPushSubscriptionJson } from "./schemas";
import type { PushMessageData, PushResponse } from "./types";

/**
 * Build a `PushMessageData` fixture with sane defaults. Useful in
 * tests that exercise transports directly.
 */
export function fakeMessage(
  overrides: Partial<PushMessageData> = {},
): PushMessageData {
  return {
    recipients: [
      { kind: "token", token: "ExponentPushToken[fake-token-12345]", platform: "expo" },
    ],
    title: "Test push",
    body: "Hello from a unit test",
    ...overrides,
  };
}

export function fakeResponse(
  overrides: Partial<PushResponse> = {},
): PushResponse {
  return {
    status: "sent",
    provider: "fake",
    platform: "expo",
    token: "ExponentPushToken[fake-token-12345]",
    providerMessageId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Canonical browser PushSubscription shape with throwaway test keys.
 * Stringify it with `JSON.stringify(fakeWebPushSubscription())` to
 * feed into `pushMessage.toToken(json, "webpush")`.
 */
export function fakeWebPushSubscription(
  overrides: Partial<WebPushSubscriptionJson> = {},
): WebPushSubscriptionJson {
  return {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc-test",
    keys: {
      p256dh: "BCYHN9C9KrI1F3dXmlfaketestkey-padding-padding-padding-padding",
      auth: "fake-auth-secret-16b",
    },
    ...overrides,
  };
}
