/**
 * Base error every WhatsApp failure inherits from. Carries a stable
 * `code` so callers (retry middleware, alerts) can branch without
 * sniffing message text.
 */
export class WhatsAppError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "WhatsAppError";
    this.code = code;
  }
}

export class InvalidPhoneNumberError extends WhatsAppError {
  constructor(phone: string) {
    super(`Invalid phone number: ${phone}`, "INVALID_PHONE_NUMBER");
    this.name = "InvalidPhoneNumberError";
  }
}

export class InvalidMessageError extends WhatsAppError {
  constructor(reason: string) {
    super(`Invalid message: ${reason}`, "INVALID_MESSAGE");
    this.name = "InvalidMessageError";
  }
}

export class RateLimitError extends WhatsAppError {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Rate limited. Retry after ${retryAfterMs}ms`, "RATE_LIMIT");
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class ProviderError extends WhatsAppError {
  readonly provider: string;
  readonly providerCode?: string;

  constructor(provider: string, message: string, providerCode?: string) {
    super(`[${provider}] ${message}`, "PROVIDER_ERROR");
    this.name = "ProviderError";
    this.provider = provider;
    this.providerCode = providerCode;
  }
}
