import type {
  AnalyticsEvent,
  AnalyticsLogger,
  AnalyticsStrategy,
  EventProperties,
} from "../types";

/**
 * Noop strategy. Default in dev + preview so analytics doesn't pollute
 * the real PostHog project with test traffic. Logs at `debug` for
 * visibility when a logger is provided.
 */
export class NullStrategy implements AnalyticsStrategy {
  readonly name = "null";
  readonly #logger?: AnalyticsLogger;

  constructor(opts: { logger?: AnalyticsLogger } = {}) {
    this.#logger = opts.logger;
  }

  capture(args: {
    distinctId: string;
    event: AnalyticsEvent;
    properties: EventProperties;
  }): void {
    this.#logger?.debug({ ...args, provider: this.name }, "analytics.capture");
  }

  identify(args: { distinctId: string; properties: EventProperties }): void {
    this.#logger?.debug({ ...args, provider: this.name }, "analytics.identify");
  }

  async flush(): Promise<void> {}
  async shutdown(): Promise<void> {}
}
