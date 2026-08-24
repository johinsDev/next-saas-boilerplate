import { MissingDependencyError, ProviderError } from "../errors";
import type {
  AnalyticsEvent,
  AnalyticsStrategy,
  EventProperties,
  PostHogProviderConfig,
} from "../types";
import { dynamicImport } from "./_lazy";

/**
 * Server strategy backed by `posthog-node`. Lazy-loaded so apps that
 * pick `null` don't carry the dep. `flushAt: 1` defaults to "send
 * immediately" so events aren't lost when a serverless function freezes.
 */
export class PostHogStrategy implements AnalyticsStrategy {
  readonly name = "posthog";
  readonly #config: PostHogProviderConfig;
  #client: PostHogClientLike | undefined;
  #initPromise: Promise<PostHogClientLike> | undefined;

  constructor(config: PostHogProviderConfig) {
    this.#config = config;
  }

  async #getClient(): Promise<PostHogClientLike> {
    if (this.#client) return this.#client;
    if (!this.#initPromise) {
      this.#initPromise = (async () => {
        let mod: { PostHog: new (key: string, opts?: PostHogInitOpts) => PostHogClientLike };
        try {
          mod = (await dynamicImport("posthog-node")) as unknown as typeof mod;
        } catch {
          throw new MissingDependencyError("posthog", "posthog-node");
        }
        this.#client = new mod.PostHog(this.#config.apiKey, {
          host: this.#config.host,
          flushAt: this.#config.flushAt ?? 1,
        });
        return this.#client;
      })();
    }
    return this.#initPromise;
  }

  capture(args: {
    distinctId: string;
    event: AnalyticsEvent;
    properties: EventProperties;
  }): void {
    // posthog-node `capture` is sync (buffers). Swallow + log errors so a
    // bad event never breaks the calling request.
    this.#getClient()
      .then((client) =>
        client.capture({
          distinctId: args.distinctId,
          event: args.event,
          properties: args.properties,
        }),
      )
      .catch((error: unknown) => {
        throw new ProviderError(this.name, asMessage(error), error);
      });
  }

  identify(args: { distinctId: string; properties: EventProperties }): void {
    this.#getClient()
      .then((client) =>
        client.identify({
          distinctId: args.distinctId,
          properties: args.properties,
        }),
      )
      .catch((error: unknown) => {
        throw new ProviderError(this.name, asMessage(error), error);
      });
  }

  async flush(): Promise<void> {
    if (!this.#client) return;
    await this.#client.flush();
  }

  async shutdown(): Promise<void> {
    if (!this.#client) return;
    await this.#client.shutdown();
    this.#client = undefined;
    this.#initPromise = undefined;
  }
}

interface PostHogInitOpts {
  host?: string;
  flushAt?: number;
}

interface PostHogClientLike {
  capture(args: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
  }): void;
  identify(args: {
    distinctId: string;
    properties?: Record<string, unknown>;
  }): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
