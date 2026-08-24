import { FakeShortlinks } from "./fake";
import { CustomStrategy } from "./strategies/custom";
import { NullStrategy } from "./strategies/null";
import type {
  ProviderConfig,
  ShortenOptions,
  ShortlinkResult,
  ShortlinksManagerConfig,
  ShortlinksStrategy,
} from "./types";

function createStrategy(config: ProviderConfig): ShortlinksStrategy {
  switch (config.provider) {
    case "null":
      return new NullStrategy();
    case "custom":
      return new CustomStrategy(config);
  }
}

/**
 * Owns the named providers and routes `shorten()` to the active one.
 * Same Manager/Strategy/Fake shape as `@saas/sms` etc.
 *
 * @example
 *   export const shortlinks = new ShortlinksManager({
 *     default: env.SHORTLINKS_PROVIDER ?? "null",
 *     providers: {
 *       null: { provider: "null" },
 *       custom: env.SHORTLINK_BASE_URL
 *         ? { provider: "custom", store, baseUrl: env.SHORTLINK_BASE_URL, logger }
 *         : undefined,
 *     },
 *   });
 */
export class ShortlinksManager<
  TProviders extends Record<string, ProviderConfig | undefined>,
> {
  readonly #config: ShortlinksManagerConfig<TProviders>;
  readonly #cache = new Map<string, ShortlinksStrategy>();
  #fake?: FakeShortlinks;

  constructor(config: ShortlinksManagerConfig<TProviders>) {
    const defined = Object.fromEntries(
      Object.entries(config.providers).filter(([, v]) => v !== undefined),
    ) as TProviders;
    this.#config = { default: config.default, providers: defined };
  }

  shorten(url: string, opts: ShortenOptions): Promise<ShortlinkResult> {
    return this.use().shorten(url, opts);
  }

  use<K extends keyof TProviders & string>(name?: K): ShortlinksStrategy {
    if (this.#fake) return this.#fake;

    const key = name ?? this.#config.default;
    if (!key) {
      throw new Error(
        "No provider name and no default configured. Set `default` on ShortlinksManagerConfig.",
      );
    }
    const cached = this.#cache.get(key);
    if (cached) return cached;

    const config = this.#config.providers[key];
    if (!config) {
      throw new Error(
        `Unknown provider "${key}". Configured: ${Object.keys(this.#config.providers).join(", ") || "<none>"}`,
      );
    }
    const strategy = createStrategy(config);
    this.#cache.set(key, strategy);
    return strategy;
  }

  /** Activate the fake strategy. Subsequent `use()`/`shorten()` use it. */
  fake(): FakeShortlinks {
    this.restore();
    this.#fake = new FakeShortlinks();
    return this.#fake;
  }

  /** Disable fake mode (cleans up after tests). */
  restore(): void {
    this.#fake = undefined;
  }
}
