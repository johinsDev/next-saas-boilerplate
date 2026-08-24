import { generateSlug } from "./slug";
import type {
  ShortenOptions,
  ShortlinkResult,
  ShortlinksStrategy,
} from "./types";

/**
 * In-memory strategy for tests. Records every `shorten()` and returns a
 * deterministic-shaped fake short URL. Activated via `shortlinks.fake()`.
 *
 * @example
 *   const fake = shortlinks.fake();
 *   await buildPromoSms();
 *   fake.assertShortened((c) => c.url.endsWith("/card"));
 *   shortlinks.restore();
 */
export class FakeShortlinks implements ShortlinksStrategy {
  readonly name = "fake";
  readonly shortened: Array<{ url: string; opts: ShortenOptions }> = [];
  readonly #baseUrl: string;

  constructor(baseUrl = "https://short.test") {
    this.#baseUrl = baseUrl;
  }

  async shorten(url: string, opts: ShortenOptions): Promise<ShortlinkResult> {
    this.shortened.push({ url, opts });
    const slug = opts.slug ?? generateSlug();
    return {
      shortUrl: `${this.#baseUrl}/${slug}`,
      slug,
      original: url,
      reused: false,
    };
  }

  clear(): void {
    this.shortened.length = 0;
  }

  assertShortened(
    findFn?: (call: { url: string; opts: ShortenOptions }) => boolean,
  ): this {
    const match = this.shortened.find((c) => (findFn ? findFn(c) : true));
    if (!match) throw new Error("Expected a URL to have been shortened");
    return this;
  }

  assertNoneShortened(): this {
    if (this.shortened.length > 0) {
      const urls = this.shortened.map((c) => c.url).join(", ");
      throw new Error(`Expected no URLs shortened, got: ${urls}`);
    }
    return this;
  }

  assertShortenedCount(count: number): this {
    if (this.shortened.length !== count) {
      throw new Error(
        `Expected ${count} URLs shortened, got ${this.shortened.length}`,
      );
    }
    return this;
  }
}
