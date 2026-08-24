import type { WhatsAppMessageData, WhatsAppResponse } from "./types";

/**
 * Build a `WhatsAppMessageData` fixture with sane defaults.
 * Useful in tests that exercise transports directly.
 */
export function fakeMessage(
  overrides: Partial<WhatsAppMessageData> = {},
): WhatsAppMessageData {
  return {
    to: "+5491155555555",
    content: "Test message",
    ...overrides,
  };
}

export function fakeResponse(
  overrides: Partial<WhatsAppResponse> = {},
): WhatsAppResponse {
  return {
    status: "sent",
    provider: "fake",
    providerMessageId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}
