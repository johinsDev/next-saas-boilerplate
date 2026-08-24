import { MissingDependencyError, ProviderError } from "../errors";
import type {
  FlagsStrategy,
  FlagValue,
  PostHogProviderConfig,
} from "../types";
import { dynamicImport } from "./_lazy";

/**
 * Server strategy backed by `posthog-node`. Lazy-loads the SDK so apps
 * that pick `null` don't carry the dep. Each call hits the PostHog API
 * — fine for pilot traffic. Local evaluation (cached flag definitions
 * via a personal API key) is a future optimisation noted in the skill.
 *
 * Failures are swallowed: a flag eval that throws (network blip, bad
 * key) returns `undefined`, so the caller's default takes over.
 */
export class PostHogStrategy implements FlagsStrategy {
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
          flushAt: 1,
        });
        return this.#client;
      })();
    }
    return this.#initPromise;
  }

  async isEnabled(args: { distinctId: string; key: string }): Promise<boolean | undefined> {
    try {
      const client = await this.#getClient();
      return await client.isFeatureEnabled(args.key, args.distinctId);
    } catch (error) {
      if (error instanceof MissingDependencyError) throw error;
      // Soft failure — let the caller's default win.
      return undefined;
    }
  }

  async getValue(args: { distinctId: string; key: string }): Promise<FlagValue | undefined> {
    try {
      const client = await this.#getClient();
      return await client.getFeatureFlag(args.key, args.distinctId);
    } catch (error) {
      if (error instanceof MissingDependencyError) throw error;
      return undefined;
    }
  }

  async getAllFlags(args: { distinctId: string }): Promise<Record<string, FlagValue>> {
    try {
      const client = await this.#getClient();
      return await client.getAllFlags(args.distinctId);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      return {};
    }
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
  isFeatureEnabled(key: string, distinctId: string): Promise<boolean | undefined>;
  getFeatureFlag(key: string, distinctId: string): Promise<FlagValue | undefined>;
  getAllFlags(distinctId: string): Promise<Record<string, FlagValue>>;
  shutdown(): Promise<void>;
}
