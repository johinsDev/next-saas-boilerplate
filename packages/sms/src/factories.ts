import type { SmsMessageData, SmsResponse } from "./types";

/**
 * Build an `SmsMessageData` fixture with sane defaults.
 * Useful in tests that exercise transports directly.
 */
export function fakeMessage(
  overrides: Partial<SmsMessageData> = {},
): SmsMessageData {
  return {
    to: "+5491155555555",
    content: "Test SMS",
    ...overrides,
  };
}

export function fakeResponse(
  overrides: Partial<SmsResponse> = {},
): SmsResponse {
  return {
    status: "sent",
    provider: "fake",
    providerMessageId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}
