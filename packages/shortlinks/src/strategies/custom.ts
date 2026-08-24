import { InvalidUrlError, SlugUnavailableError } from "../errors";
import { generateSlug, isValidSlug } from "../slug";
import type {
  CustomProviderConfig,
  ShortenOptions,
  ShortlinkResult,
  ShortlinksLogger,
  ShortlinkStore,
  ShortlinksStrategy,
} from "../types";

const MAX_SLUG_ATTEMPTS = 5;

/**
 * Self-hosted provider. Generates a slug, persists `slug → targetUrl`
 * via the injected `ShortlinkStore`, and returns `${baseUrl}/${slug}`.
 * The redirect itself is served elsewhere (the Worker) off the same
 * store. Programmatic calls dedupe on (org, target) so re-sending the
 * same campaign reuses one slug.
 */
export class CustomStrategy implements ShortlinksStrategy {
  readonly name = "custom";
  readonly #store: ShortlinkStore;
  readonly #baseUrl: string;
  readonly #logger?: ShortlinksLogger;

  constructor(config: CustomProviderConfig) {
    this.#store = config.store;
    this.#baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.#logger = config.logger;
  }

  async shorten(url: string, opts: ShortenOptions): Promise<ShortlinkResult> {
    this.#assertHttpUrl(url);

    // Explicit custom slug (manual create): must be valid + available.
    if (opts.slug) {
      if (!isValidSlug(opts.slug)) throw new SlugUnavailableError(opts.slug);
      if (await this.#store.slugExists(opts.slug)) {
        throw new SlugUnavailableError(opts.slug);
      }
      await this.#store.create({
        slug: opts.slug,
        targetUrl: url,
        organizationId: opts.organizationId,
        expiresAt: opts.expiresAt,
        createdByUserId: opts.createdByUserId,
        campaignId: opts.campaignId,
        customerId: opts.customerId,
      });
      return this.#result(opts.slug, url, false);
    }

    // Per-recipient campaign links skip dedupe so each recipient gets a unique,
    // attributable slug; everything else reuses an active slug for (org, target).
    const perRecipient = Boolean(opts.campaignId && opts.customerId);
    const existing = perRecipient
      ? null
      : await this.#store.findActiveByTarget(opts.organizationId, url);
    if (existing) return this.#result(existing.slug, url, true);

    // Fresh random slug, retrying on the rare collision.
    let slug = generateSlug();
    for (
      let attempt = 0;
      attempt < MAX_SLUG_ATTEMPTS && (await this.#store.slugExists(slug));
      attempt++
    ) {
      slug = generateSlug();
    }
    await this.#store.create({
      slug,
      targetUrl: url,
      organizationId: opts.organizationId,
      expiresAt: opts.expiresAt,
      createdByUserId: opts.createdByUserId,
      campaignId: opts.campaignId,
      customerId: opts.customerId,
    });
    this.#logger?.info(
      { _service: "shortlinks", slug, target: url, org: opts.organizationId },
      "shortlink.created",
    );
    return this.#result(slug, url, false);
  }

  #assertHttpUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new InvalidUrlError(url);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new InvalidUrlError(url);
    }
  }

  #result(slug: string, original: string, reused: boolean): ShortlinkResult {
    return { shortUrl: `${this.#baseUrl}/${slug}`, slug, original, reused };
  }
}
