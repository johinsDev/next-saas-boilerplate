/**
 * Options for a `shorten()` call. `organizationId` scopes the link;
 * `slug` forces a custom slug (manual creation) instead of an
 * auto-generated one.
 */
export interface ShortenOptions {
  organizationId: string;
  /** Custom slug (manual create). Auto-generated base62 when omitted. */
  slug?: string;
  expiresAt?: Date;
  createdByUserId?: string;
  /**
   * Per-recipient campaign attribution. When both are set the link is minted
   * fresh (dedupe is skipped) so each recipient gets a unique, attributable
   * slug for the campaign "Clic" funnel.
   */
  campaignId?: string;
  customerId?: string;
}

/** Result of a `shorten()`. With the `null` provider, `shortUrl === original`. */
export interface ShortlinkResult {
  /** The short URL to embed in the message. */
  shortUrl: string;
  /** The slug, or `null` for the passthrough (`null`) provider. */
  slug: string | null;
  /** The original long URL. */
  original: string;
  /** `true` when an existing active slug for the same target was reused. */
  reused: boolean;
}

/**
 * Persistence port the `custom` provider writes through. The package
 * stays free of Drizzle / `@saas/db`: the app supplies an adapter
 * backed by the real repository.
 */
export interface ShortlinkStore {
  /** Existing active slug for this (org, target), or null. Powers dedupe. */
  findActiveByTarget(
    organizationId: string,
    targetUrl: string,
  ): Promise<{ slug: string } | null>;
  /** Whether a slug is already taken (host-wide). */
  slugExists(slug: string): Promise<boolean>;
  /** Persist a new shortlink row. */
  create(input: {
    slug: string;
    targetUrl: string;
    organizationId: string;
    expiresAt?: Date;
    createdByUserId?: string;
    campaignId?: string;
    customerId?: string;
  }): Promise<{ slug: string }>;
}

/** Interface every provider strategy implements. */
export interface ShortlinksStrategy {
  readonly name: string;
  shorten(url: string, opts: ShortenOptions): Promise<ShortlinkResult>;
}

/** Narrow slice of `@saas/log`'s `Logger`. */
export interface ShortlinksLogger {
  info(bindings: Record<string, unknown>, msg?: string): void;
  warn(bindings: Record<string, unknown>, msg?: string): void;
  error(bindings: Record<string, unknown>, msg?: string): void;
}

/** Passthrough provider (dev): returns the URL unchanged. */
export interface NullProviderConfig {
  provider: "null";
}

/** Self-hosted provider (preview/prod): slug store + short host. */
export interface CustomProviderConfig {
  provider: "custom";
  store: ShortlinkStore;
  /** Short host base URL, no trailing slash, e.g. `https://l.t4diverclub.app`. */
  baseUrl: string;
  logger?: ShortlinksLogger;
}

export type ProviderConfig = NullProviderConfig | CustomProviderConfig;

export interface ShortlinksManagerConfig<
  T extends Record<string, ProviderConfig | undefined>,
> {
  default: keyof T & string;
  providers: T;
}
