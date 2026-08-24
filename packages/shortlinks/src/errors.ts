/**
 * Base error every shortlinks failure inherits from. Carries a stable
 * `code` so callers can branch without sniffing message text.
 */
export class ShortlinksError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "ShortlinksError";
    this.code = code;
  }
}

export class InvalidUrlError extends ShortlinksError {
  constructor(url: string) {
    super(`Invalid URL to shorten: ${url}`, "INVALID_URL");
    this.name = "InvalidUrlError";
  }
}

export class SlugUnavailableError extends ShortlinksError {
  readonly slug: string;

  constructor(slug: string) {
    super(`Slug already in use: ${slug}`, "SLUG_UNAVAILABLE");
    this.name = "SlugUnavailableError";
    this.slug = slug;
  }
}

export class ProviderError extends ShortlinksError {
  readonly provider: string;

  constructor(provider: string, message: string) {
    super(`[${provider}] ${message}`, "PROVIDER_ERROR");
    this.name = "ProviderError";
    this.provider = provider;
  }
}
