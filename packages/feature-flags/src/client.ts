"use client";

// Browser entry: `import { createFlags } from "@saas/feature-flags/client"`.

import { MissingDependencyError } from "./errors";
import type { Flags, FlagKey, FlagValue, ProviderConfig } from "./types";

interface CreateFlagsOptions {
  provider: ProviderConfig;
}

/**
 * Build a browser-side `Flags` surface. `null` → returns defaults
 * synchronously. `posthog` lazy-loads `posthog-js` and reads from its
 * cached flag state.
 *
 * Idempotent init: if `@saas/analytics`'s `AnalyticsProvider`
 * already initialised posthog-js with the same key, the second init
 * here is a noop (posthog-js handles this internally).
 */
export function createFlags(opts: CreateFlagsOptions): Flags {
  if (opts.provider.provider === "null") {
    return makeNullFlags();
  }
  if (typeof window === "undefined") {
    return makeNullFlags();
  }
  return makePostHogFlags(opts.provider);
}

function makeNullFlags(): Flags {
  return {
    isEnabled(_key, defaultValue = false) {
      return defaultValue;
    },
    getValue(_key, defaultValue) {
      return defaultValue ?? false;
    },
    reload() {},
    isLoaded() {
      return true;
    },
    onChange(_cb) {
      return () => {};
    },
  };
}

interface PostHogJsLike {
  init(key: string, opts: Record<string, unknown>): void;
  isFeatureEnabled(key: string): boolean | undefined;
  getFeatureFlag(key: string): FlagValue | undefined;
  onFeatureFlags(cb: () => void): () => void;
  reloadFeatureFlags(): void;
}

function makePostHogFlags(
  config: Extract<ProviderConfig, { provider: "posthog" }>,
): Flags {
  let client: PostHogJsLike | undefined;
  let loaded = false;
  let initPromise: Promise<PostHogJsLike> | undefined;
  const subscribers = new Set<() => void>();
  let unsubscribeFromPostHog: (() => void) | undefined;

  const init = async (): Promise<PostHogJsLike> => {
    if (client) return client;
    if (initPromise) return initPromise;
    initPromise = (async () => {
      let mod: { default: PostHogJsLike };
      try {
        // Literal `import()` (not the Function-wrapped `dynamicImport`): this
        // runs ONLY in the browser, so the bundler must see the specifier to
        // code-split posthog-js into a lazy chunk. The Function-hack hides it
        // from the bundler — fine server-side (Node resolves bare specifiers at
        // runtime) but fatal here (the browser can't resolve an unbundled bare
        // specifier). client.ts never runs on the Worker, so no code-gen risk.
        mod = (await import("posthog-js")) as unknown as typeof mod;
      } catch {
        throw new MissingDependencyError("posthog", "posthog-js");
      }
      const ph = mod.default;
      // Guard: analytics + feature-flags share the one posthog-js singleton.
      // Init only if nobody initialised it yet — a second init() is a no-op that
      // logs a warning. onFeatureFlags() below works on the singleton regardless.
      if (!(ph as { __loaded?: boolean }).__loaded) {
        ph.init(config.apiKey, {
          api_host: config.host ?? "https://us.i.posthog.com",
          capture_pageview: false,
          persistence: "localStorage+cookie",
        });
      }
      client = ph;
      unsubscribeFromPostHog = ph.onFeatureFlags(() => {
        loaded = true;
        for (const cb of subscribers) cb();
      });
      return ph;
    })();
    return initPromise;
  };

  // Fire-and-forget initialisation; reads before it resolves return defaults.
  void init();

  return {
    isEnabled(key: FlagKey, defaultValue = false): boolean {
      if (!client) return defaultValue;
      const v = client.isFeatureEnabled(key);
      return v === undefined ? defaultValue : v;
    },
    getValue(key: FlagKey, defaultValue?: FlagValue): FlagValue {
      if (!client) return defaultValue ?? false;
      const v = client.getFeatureFlag(key);
      return v === undefined ? (defaultValue ?? false) : v;
    },
    reload(): void {
      client?.reloadFeatureFlags();
    },
    isLoaded(): boolean {
      return loaded;
    },
    onChange(cb: () => void): () => void {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
        if (subscribers.size === 0) {
          unsubscribeFromPostHog?.();
          unsubscribeFromPostHog = undefined;
        }
      };
    },
  };
}

export type { Flags, FlagKey, FlagValue, ProviderConfig } from "./types";
