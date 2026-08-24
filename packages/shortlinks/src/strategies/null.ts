import type {
  ShortenOptions,
  ShortlinkResult,
  ShortlinksStrategy,
} from "../types";

/**
 * Passthrough provider (dev). Returns the original URL untouched — no
 * store, no redirect needed. The message still works; it's just long.
 */
export class NullStrategy implements ShortlinksStrategy {
  readonly name = "null";

  async shorten(url: string, _opts: ShortenOptions): Promise<ShortlinkResult> {
    return { shortUrl: url, slug: null, original: url, reused: false };
  }
}
