/**
 * Properties baked onto every event for filtering in PostHog. Server
 * builds these per request; the client registers them on init so they
 * tag every browser event automatically.
 */
export interface BaseProperties {
  /** Which app emitted the event. */
  app: "web" | "admin" | "api";
  /** Vercel runtime: `production` / `preview` / `development`. */
  environment: string;
  /** Active locale (`es` / `en`). */
  locale?: string;
}

export type EventProperties = Record<string, unknown>;

/**
 * Canonical event names. Adding a new event = extend this union AND
 * note it in `.claude/skills/analytics/SKILL.md`. Strings are still
 * accepted at runtime so feature work isn't blocked on a type bump,
 * but the union keeps typo-driven divergence visible at review.
 */
export type AnalyticsEvent =
  | "subscription.started"
  | "subscription.cancelled"
  | "auth.signed_in"
  | "auth.signed_out"
  | "$pageview"
  | (string & {});

export interface AnalyticsLogger {
  debug(bindings: Record<string, unknown>, msg?: string): void;
  info(bindings: Record<string, unknown>, msg?: string): void;
  warn(bindings: Record<string, unknown>, msg?: string): void;
  error(bindings: Record<string, unknown>, msg?: string): void;
}

/** Server-side strategy — every provider implements this shape. */
export interface AnalyticsStrategy {
  readonly name: string;
  capture(args: {
    distinctId: string;
    event: AnalyticsEvent;
    properties: EventProperties;
  }): void;
  identify(args: {
    distinctId: string;
    properties: EventProperties;
  }): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface NullProviderConfig {
  provider: "null";
}

export interface PostHogProviderConfig {
  provider: "posthog";
  /** PostHog project API key (`phc_...`). Public, embeddable. */
  apiKey: string;
  /** `https://us.i.posthog.com` (default) or your self-hosted host. */
  host?: string;
  /**
   * `flushAt` for posthog-node. Default 1 for serverless (don't keep
   * events buffered when the lambda freezes).
   */
  flushAt?: number;
  /**
   * `fetch` = REST via fetch, Cloudflare-Workers-safe; default `node`
   * (posthog-node) for Node runtimes.
   */
  driver?: "node" | "fetch";
}

export type ProviderConfig = NullProviderConfig | PostHogProviderConfig;

/**
 * Per-request shape bound on the tRPC ctx. `distinctId` and base
 * properties are pre-resolved so routers just write
 * `ctx.analytics.capture("subscription.started", { cardId })`.
 */
export interface AnalyticsBinding {
  capture(event: AnalyticsEvent, properties?: EventProperties): void;
  identify(properties: EventProperties): void;
  page(properties?: EventProperties): void;
}

/**
 * Browser-side surface returned by `createAnalytics` and exposed by
 * the React Context. `identify` here takes the distinctId explicitly
 * (the provider does NOT have a session — the caller passes the
 * user id after login).
 */
export interface Analytics {
  track(event: AnalyticsEvent, properties?: EventProperties): void;
  page(properties?: EventProperties): void;
  identify(distinctId: string, properties?: EventProperties): void;
  reset(): void;
}
