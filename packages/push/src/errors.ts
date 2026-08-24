/**
 * Base error every push failure inherits from. Carries a stable
 * `code` so callers (retry middleware, alerts, the auto sender) can
 * branch without sniffing message text.
 */
export class PushError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "PushError";
    this.code = code;
  }
}

export class InvalidTokenError extends PushError {
  constructor(reason: string) {
    super(`Invalid push token: ${reason}`, "INVALID_TOKEN");
    this.name = "InvalidTokenError";
  }
}

/**
 * Thrown when the destination has gone away — a browser revoked its
 * web push subscription (HTTP 410 Gone) or an Expo install was
 * uninstalled / re-installed (`DeviceNotRegistered`). The auto sender
 * collects these so callers can deactivate the matching `push_token`
 * row.
 */
export class SubscriptionExpiredError extends PushError {
  readonly token: string;

  constructor(token: string) {
    super(`Push subscription expired for token ${token.slice(0, 16)}…`, "EXPIRED");
    this.name = "SubscriptionExpiredError";
    this.token = token;
  }
}

export class InvalidMessageError extends PushError {
  constructor(reason: string) {
    super(`Invalid push message: ${reason}`, "INVALID_MESSAGE");
    this.name = "InvalidMessageError";
  }
}

export class RateLimitError extends PushError {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Rate limited. Retry after ${retryAfterMs}ms`, "RATE_LIMIT");
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class ProviderError extends PushError {
  readonly provider: string;
  readonly providerCode?: string;
  override readonly cause?: unknown;

  constructor(
    provider: string,
    message: string,
    providerCode?: string,
    cause?: unknown,
  ) {
    super(`[${provider}] ${message}`, "PROVIDER_ERROR");
    this.name = "ProviderError";
    this.provider = provider;
    this.providerCode = providerCode;
    this.cause = cause;
  }
}

export class MissingDependencyError extends ProviderError {
  constructor(provider: string, packageName: string) {
    super(
      provider,
      `${packageName} is not installed. Run "bun add ${packageName}" to use the ${provider} provider.`,
    );
    this.name = "MissingDependencyError";
  }
}
