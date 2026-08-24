import type {
  FlagsStrategy,
  FlagValue,
  PostHogProviderConfig,
} from "../types";

const DEFAULT_HOST = "https://us.i.posthog.com";

interface DecideResponse {
  featureFlags?: Record<string, boolean | string>;
  featureFlagPayloads?: Record<string, unknown>;
}

/**
 * Server strategy backed by PostHog's `/decide` REST endpoint via plain
 * `fetch` — no `posthog-node`, so it runs on Cloudflare Workers (workerd
 * forbids the `new Function`-based dynamic import the Node SDK is
 * lazy-loaded with). Every call performs a remote evaluation.
 *
 * Failures are swallowed: a decide that throws or returns non-2xx yields
 * `undefined` / `{}`, so the caller's default takes over.
 */
export class PostHogFetchStrategy implements FlagsStrategy {
  readonly name = "posthog";
  readonly #apiKey: string;
  readonly #host: string;

  constructor(config: PostHogProviderConfig) {
    this.#apiKey = config.apiKey;
    this.#host = (config.host ?? DEFAULT_HOST).replace(/\/$/, "");
  }

  async isEnabled(args: { distinctId: string; key: string }): Promise<boolean | undefined> {
    const flags = await this.#decide(args.distinctId);
    if (!flags) return undefined;
    const value = flags[args.key];
    // A boolean `true` OR a string variant both mean "enabled". A missing
    // flag stays `undefined` so the caller's default wins.
    return value === undefined ? undefined : value !== false;
  }

  async getValue(args: { distinctId: string; key: string }): Promise<FlagValue | undefined> {
    const flags = await this.#decide(args.distinctId);
    return flags?.[args.key];
  }

  async getAllFlags(args: { distinctId: string }): Promise<Record<string, FlagValue>> {
    return (await this.#decide(args.distinctId)) ?? {};
  }

  async shutdown(): Promise<void> {
    // No client/buffer to tear down.
  }

  /**
   * POST `/decide/?v=3` and return the `featureFlags` map. Soft-fails to
   * `undefined` on any network/parse/non-ok error so reads degrade to the
   * caller's defaults.
   */
  async #decide(distinctId: string): Promise<Record<string, boolean | string> | undefined> {
    try {
      const response = await fetch(`${this.#host}/decide/?v=3`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: this.#apiKey, distinct_id: distinctId }),
      });
      if (!response.ok) return undefined;
      const data = (await response.json()) as DecideResponse;
      return data.featureFlags ?? {};
    } catch {
      return undefined;
    }
  }
}
