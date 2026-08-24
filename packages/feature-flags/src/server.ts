// Server entry: `import { FlagsManager } from "@saas/feature-flags/server"`.

import { FakeFlags } from "./fake-flags";
import { NullStrategy } from "./providers/null-server";
import { PostHogFetchStrategy } from "./providers/posthog-fetch";
import { PostHogStrategy } from "./providers/posthog-server";
import type {
  FlagKey,
  FlagValue,
  FlagsBinding,
  FlagsLogger,
  FlagsStrategy,
  ProviderConfig,
} from "./types";

function createStrategy(
  config: ProviderConfig,
  logger?: FlagsLogger,
): FlagsStrategy {
  switch (config.provider) {
    case "null":
      return new NullStrategy({ logger });
    case "posthog":
      return config.driver === "fetch"
        ? new PostHogFetchStrategy(config)
        : new PostHogStrategy(config);
  }
}

/**
 * Owns the strategy + factory for per-request bindings. Same shape as
 * `CacheManager` / `RateLimiter` / `AnalyticsManager`.
 *
 * @example
 *   export const flags = new FlagsManager({
 *     provider:
 *       env.FEATURE_FLAGS_PROVIDER === "posthog" && env.NEXT_PUBLIC_POSTHOG_KEY
 *         ? { provider: "posthog", apiKey: env.NEXT_PUBLIC_POSTHOG_KEY, host: env.NEXT_PUBLIC_POSTHOG_HOST }
 *         : { provider: "null" },
 *     logger: log,
 *   });
 *
 *   // per request, in the tRPC route handler:
 *   const binding = flags.forRequest({ distinctId: resolveDistinctId(ctx) });
 *   return { ...ctx, flags: binding };
 *
 *   // in a router:
 *   if (await ctx.flags?.isEnabled("new-checkout-flow")) { … }
 */
export class FlagsManager {
  readonly #config: ProviderConfig;
  readonly #logger?: FlagsLogger;
  #strategy: FlagsStrategy | undefined;
  #fake: FakeFlags | undefined;

  constructor(opts: { provider: ProviderConfig; logger?: FlagsLogger }) {
    this.#config = opts.provider;
    this.#logger = opts.logger;
  }

  #use(): FlagsStrategy {
    if (this.#fake) return this.#fake;
    if (!this.#strategy) {
      this.#strategy = createStrategy(this.#config, this.#logger);
    }
    return this.#strategy;
  }

  /**
   * Bind the strategy to a single request — `distinctId` is baked in,
   * so callers just write `await binding.isEnabled("my-flag")`.
   * Defaults supplied per-call so a single flag can mean different
   * things on different procedures.
   */
  forRequest(opts: { distinctId: string }): FlagsBinding {
    const strategy = this.#use();
    const { distinctId } = opts;
    return {
      async isEnabled(key: FlagKey, defaultValue = false): Promise<boolean> {
        const result = await strategy.isEnabled({ distinctId, key });
        return result ?? defaultValue;
      },
      async getValue(key: FlagKey, defaultValue?: FlagValue): Promise<FlagValue> {
        const result = await strategy.getValue({ distinctId, key });
        return result ?? defaultValue ?? false;
      },
      async getAllFlags(): Promise<Record<string, FlagValue>> {
        return strategy.getAllFlags({ distinctId });
      },
    };
  }

  /** Swap in a deterministic in-memory fake for tests. */
  fake(fake?: FakeFlags): FakeFlags {
    this.#fake = fake ?? new FakeFlags();
    return this.#fake;
  }

  restore(): void {
    this.#fake = undefined;
  }

  shutdown(): Promise<void> {
    return this.#use().shutdown();
  }
}

export { FakeFlags } from "./fake-flags";
export type {
  FlagKey,
  FlagsBinding,
  FlagsStrategy,
  FlagValue,
  ProviderConfig,
} from "./types";
