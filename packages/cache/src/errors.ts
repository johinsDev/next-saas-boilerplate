/**
 * Base error every cache failure inherits from. Carries a stable
 * `code` so callers (retry middleware, alerts) can branch without
 * sniffing message text.
 */
export class CacheError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "CacheError";
    this.code = code;
  }
}

export class ProviderError extends CacheError {
  readonly provider: string;
  override readonly cause?: unknown;

  constructor(provider: string, message: string, cause?: unknown) {
    super(`[${provider}] ${message}`, "PROVIDER_ERROR");
    this.name = "ProviderError";
    this.provider = provider;
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
