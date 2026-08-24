"use client";

// Browser entry: `import { createAnalytics } from "@saas/analytics/client"`.

import { MissingDependencyError } from "./errors";
import type {
  Analytics,
  AnalyticsEvent,
  BaseProperties,
  EventProperties,
  ProviderConfig,
} from "./types";

interface CreateAnalyticsOptions {
  provider: ProviderConfig;
  /** Registered as super-properties on every event. */
  baseProperties: BaseProperties;
}

/**
 * Build a browser-side `Analytics`. `null` → noop. `posthog` lazy-loads
 * `posthog-js` and initialises with `capture_pageview: false` (App
 * Router does manual pageviews — see `AnalyticsProvider`).
 *
 * Safe to call during SSR: posthog-js is only loaded inside a `if
 * (typeof window !== "undefined")` branch.
 */
export function createAnalytics(opts: CreateAnalyticsOptions): Analytics {
  if (opts.provider.provider === "null") {
    return makeNullAnalytics();
  }

  // SSR safety — return noop until mounted; the AnalyticsProvider
  // re-instantiates on the client.
  if (typeof window === "undefined") {
    return makeNullAnalytics();
  }

  return makePostHogAnalytics(opts.provider, opts.baseProperties);
}

function makeNullAnalytics(): Analytics {
  return {
    track() {},
    page() {},
    identify() {},
    reset() {},
  };
}

interface PostHogJsLike {
  init(key: string, opts: Record<string, unknown>): void;
  register(props: Record<string, unknown>): void;
  capture(event: string, props?: Record<string, unknown>): void;
  identify(distinctId: string, props?: Record<string, unknown>): void;
  reset(): void;
}

function makePostHogAnalytics(
  config: Extract<ProviderConfig, { provider: "posthog" }>,
  baseProperties: BaseProperties,
): Analytics {
  let client: PostHogJsLike | undefined;
  let initPromise: Promise<PostHogJsLike> | undefined;
  const queue: Array<(c: PostHogJsLike) => void> = [];

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
      // Whichever loads first calls init(); a second init() is a no-op that logs
      // a warning, so skip it when already loaded. register() still applies.
      if (!(ph as { __loaded?: boolean }).__loaded) {
        ph.init(config.apiKey, {
          api_host: config.host ?? "https://us.i.posthog.com",
          capture_pageview: false,
          capture_pageleave: true,
          persistence: "localStorage+cookie",
        });
      }
      ph.register({ ...baseProperties });
      client = ph;
      for (const fn of queue.splice(0)) fn(ph);
      return ph;
    })();
    return initPromise;
  };

  // Kick off init; queue calls until ready.
  void init();

  const enqueue = (fn: (c: PostHogJsLike) => void): void => {
    if (client) fn(client);
    else queue.push(fn);
  };

  return {
    track(event: AnalyticsEvent, properties?: EventProperties): void {
      enqueue((c) => c.capture(event, properties));
    },
    page(properties?: EventProperties): void {
      enqueue((c) => c.capture("$pageview", properties));
    },
    identify(distinctId: string, properties?: EventProperties): void {
      enqueue((c) => c.identify(distinctId, properties));
    },
    reset(): void {
      enqueue((c) => c.reset());
    },
  };
}

export type {
  Analytics,
  AnalyticsEvent,
  BaseProperties,
  EventProperties,
  ProviderConfig,
} from "./types";
