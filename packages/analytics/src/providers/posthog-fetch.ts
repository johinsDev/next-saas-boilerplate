import type {
  AnalyticsEvent,
  AnalyticsStrategy,
  EventProperties,
  PostHogProviderConfig,
} from "../types";

const DEFAULT_HOST = "https://us.i.posthog.com";

/**
 * Server strategy backed by PostHog's public capture REST endpoint via
 * plain `fetch` — no `posthog-node`, so it runs on Cloudflare Workers
 * (workerd forbids the `new Function`-based dynamic import the Node SDK
 * is lazy-loaded with). Each event is one fire-and-forget POST; there is
 * no buffer, so `flush`/`shutdown` are no-ops.
 *
 * Analytics is best-effort: every failure is swallowed so a bad event
 * (network blip, non-2xx) never breaks the calling request.
 */
export class PostHogFetchStrategy implements AnalyticsStrategy {
  readonly name = "posthog";
  readonly #apiKey: string;
  readonly #host: string;

  constructor(config: PostHogProviderConfig) {
    this.#apiKey = config.apiKey;
    this.#host = (config.host ?? DEFAULT_HOST).replace(/\/$/, "");
  }

  capture(args: {
    distinctId: string;
    event: AnalyticsEvent;
    properties: EventProperties;
  }): void {
    this.#send({
      event: args.event,
      distinct_id: args.distinctId,
      properties: args.properties,
      timestamp: new Date().toISOString(),
    });
  }

  identify(args: { distinctId: string; properties: EventProperties }): void {
    this.#send({
      event: "$identify",
      distinct_id: args.distinctId,
      properties: { $set: args.properties },
    });
  }

  async flush(): Promise<void> {
    // Fetch sends immediately — nothing to flush.
  }

  async shutdown(): Promise<void> {
    // No client/buffer to tear down.
  }

  #send(body: Record<string, unknown>): void {
    // Fire-and-forget: the interface's `capture`/`identify` are sync. We
    // kick off the request and swallow any rejection so analytics never
    // surfaces an error to the caller.
    void fetch(`${this.#host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: this.#apiKey, ...body }),
    }).catch(() => {
      // Best-effort: swallow.
    });
  }
}
