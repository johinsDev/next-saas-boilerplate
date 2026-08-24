/**
 * Base error every feature-flag failure inherits from. Carries a stable
 * `code` so callers can branch without sniffing message text.
 */
export class FeatureFlagsError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "FeatureFlagsError";
    this.code = code;
  }
}

export class ProviderError extends FeatureFlagsError {
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
