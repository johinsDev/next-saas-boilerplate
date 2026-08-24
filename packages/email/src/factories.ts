import type { EmailMessageData, EmailResponse } from "./types";

/**
 * Build an `EmailMessageData` fixture with sane defaults. Useful in
 * tests that exercise transports directly.
 */
export function fakeMessage(
  overrides: Partial<EmailMessageData> = {},
): EmailMessageData {
  return {
    to: ["lucia@example.com"],
    from: "notifications@acme.app",
    subject: "Test email",
    html: "<p>Hello</p>",
    text: "Hello",
    ...overrides,
  };
}

export function fakeResponse(
  overrides: Partial<EmailResponse> = {},
): EmailResponse {
  return {
    status: "sent",
    provider: "fake",
    providerMessageId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}
