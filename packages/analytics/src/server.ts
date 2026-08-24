// Server entry: `import { AnalyticsManager } from "@saas/analytics/server"`.

import { FakeAnalytics } from "./fake-analytics";
import { NullStrategy } from "./providers/null-server";
import { PostHogFetchStrategy } from "./providers/posthog-fetch";
import { PostHogStrategy } from "./providers/posthog-server";
import type {
  AnalyticsBinding,
  AnalyticsEvent,
  AnalyticsLogger,
  AnalyticsStrategy,
  BaseProperties,
  EventProperties,
  ProviderConfig,
} from "./types";

function createStrategy(
  config: ProviderConfig,
  logger?: AnalyticsLogger,
): AnalyticsStrategy {
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
 * `CacheManager` / `RateLimiter` so the bootstrap + testing patterns
 * transfer.
 *
 * @example
 *   export const analytics = new AnalyticsManager({
 *     provider: env.ANALYTICS_PROVIDER === "posthog"
 *       ? { provider: "posthog", apiKey: env.NEXT_PUBLIC_POSTHOG_KEY!, host: env.NEXT_PUBLIC_POSTHOG_HOST }
 *       : { provider: "null" },
 *     logger: log,
 *   });
 *
 *   // per request, in the tRPC route handler:
 *   const binding = analytics.forRequest({
 *     distinctId: resolveDistinctId(ctx),
 *     baseProperties: { app: "web", environment, locale },
 *   });
 *   return { ...ctx, analytics: binding };
 */
export class AnalyticsManager {
  readonly #config: ProviderConfig;
  readonly #logger?: AnalyticsLogger;
  #strategy: AnalyticsStrategy | undefined;
  #fake: FakeAnalytics | undefined;

  constructor(opts: { provider: ProviderConfig; logger?: AnalyticsLogger }) {
    this.#config = opts.provider;
    this.#logger = opts.logger;
  }

  #use(): AnalyticsStrategy {
    if (this.#fake) return this.#fake;
    if (!this.#strategy) {
      this.#strategy = createStrategy(this.#config, this.#logger);
    }
    return this.#strategy;
  }

  /**
   * Bind the strategy to a single request — `distinctId` and base
   * properties are baked in, so callers just write
   * `binding.capture("subscription.started", { cardId })`.
   */
  forRequest(opts: {
    distinctId: string;
    baseProperties: BaseProperties;
  }): AnalyticsBinding {
    const strategy = this.#use();
    const { distinctId, baseProperties } = opts;
    return {
      capture(event: AnalyticsEvent, properties?: EventProperties): void {
        strategy.capture({
          distinctId,
          event,
          properties: { ...baseProperties, ...properties },
        });
      },
      identify(properties: EventProperties): void {
        strategy.identify({
          distinctId,
          properties: { ...baseProperties, ...properties },
        });
      },
      page(properties?: EventProperties): void {
        strategy.capture({
          distinctId,
          event: "$pageview",
          properties: { ...baseProperties, ...properties },
        });
      },
    };
  }

  /** Swap in a recording fake for tests. */
  fake(fake?: FakeAnalytics): FakeAnalytics {
    this.#fake = fake ?? new FakeAnalytics();
    return this.#fake;
  }

  restore(): void {
    this.#fake = undefined;
  }

  flush(): Promise<void> {
    return this.#use().flush();
  }

  shutdown(): Promise<void> {
    return this.#use().shutdown();
  }
}

export { FakeAnalytics } from "./fake-analytics";
export type {
  AnalyticsBinding,
  AnalyticsEvent,
  AnalyticsStrategy,
  BaseProperties,
  EventProperties,
  ProviderConfig,
} from "./types";
