/**
 * Base error every storage failure inherits from. Carries a stable
 * `code` so callers (retry middleware, alerts) can branch without
 * sniffing message text.
 */
export class StorageError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

export class FileNotFoundError extends StorageError {
  readonly key: string;

  constructor(key: string) {
    super(`File not found: ${key}`, "FILE_NOT_FOUND");
    this.name = "FileNotFoundError";
    this.key = key;
  }
}

export class FileTooLargeError extends StorageError {
  readonly size: number;
  readonly maxSize: number;

  constructor(size: number, maxSize: number) {
    super(`File too large: ${size}B > ${maxSize}B`, "FILE_TOO_LARGE");
    this.name = "FileTooLargeError";
    this.size = size;
    this.maxSize = maxSize;
  }
}

export class SignedUrlError extends StorageError {
  constructor(message: string) {
    super(`Signed URL: ${message}`, "SIGNED_URL");
    this.name = "SignedUrlError";
  }
}

export class InvalidTokenError extends StorageError {
  constructor(reason: string) {
    super(`Invalid storage token: ${reason}`, "INVALID_TOKEN");
    this.name = "InvalidTokenError";
  }
}

export class ProviderError extends StorageError {
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
