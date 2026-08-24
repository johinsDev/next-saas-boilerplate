"use client";

import { useSession } from "@saas/auth/client";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { createAnalytics } from "./client";
import type { Analytics, BaseProperties, ProviderConfig } from "./types";

interface ProviderProps {
  /** Strategy: `"null"` (noop) or `"posthog"`. */
  provider: ProviderConfig["provider"];
  /** PostHog project API key (`phc_...`). Ignored when provider is `"null"`. */
  apiKey?: string;
  /** PostHog host. Defaults to `https://us.i.posthog.com` on the client. */
  host?: string;
  /** Tagged on every event as the `app` super-property. */
  app: BaseProperties["app"];
  /** Tagged on every event (typically `process.env.VERCEL_ENV ?? "development"`). */
  environment: string;
  /** Tagged on every event. Pass from `useLocale()` in the host app. */
  locale?: string;
  children: ReactNode;
}

const AnalyticsContext = createContext<Analytics | null>(null);

/**
 * Wraps the app once (high in `providers.tsx`). Creates the Analytics
 * instance, **auto-identifies** when a session is present (covers every
 * sign-in path — phone OTP, Google, email/password — without touching
 * the forms), **auto-resets** on sign-out, and emits a `$pageview`
 * on every navigation (App Router pattern).
 */
export function AnalyticsProvider(props: ProviderProps): ReactNode {
  const config = useMemo<ProviderConfig>(() => {
    if (props.provider === "posthog" && props.apiKey) {
      return { provider: "posthog", apiKey: props.apiKey, host: props.host };
    }
    return { provider: "null" };
  }, [props.provider, props.apiKey, props.host]);

  const baseProperties = useMemo<BaseProperties>(
    () => ({ app: props.app, environment: props.environment, locale: props.locale }),
    [props.app, props.environment, props.locale],
  );

  const analyticsRef = useRef<Analytics | null>(null);
  if (!analyticsRef.current) {
    analyticsRef.current = createAnalytics({
      provider: config,
      baseProperties,
    });
  }
  const analytics = analyticsRef.current;

  // Auto-identify on session presence, auto-reset on logout. Tracks the
  // previously-identified user id so we only flip between identify and
  // reset on actual transitions.
  const session = useSession();
  const lastIdRef = useRef<string | null>(null);
  useEffect(() => {
    const userId = (session?.data?.user as { id?: string } | undefined)?.id ?? null;
    if (userId && userId !== lastIdRef.current) {
      const user = session?.data?.user as { id: string; email?: string | null; name?: string | null };
      analytics.identify(userId, {
        email: user.email ?? undefined,
        name: user.name ?? undefined,
      });
      lastIdRef.current = userId;
    } else if (!userId && lastIdRef.current) {
      analytics.reset();
      lastIdRef.current = null;
    }
  }, [analytics, session?.data?.user]);

  return (
    <AnalyticsContext.Provider value={analytics}>
      {/* `useSearchParams` (in the tracker) forces the nearest boundary dynamic
          under PPR/`cacheComponents`; isolating it here keeps the wrapped app
          (`children`) statically prerenderable instead of the whole tree. */}
      <Suspense fallback={null}>
        <PageViewTracker analytics={analytics} />
      </Suspense>
      {props.children}
    </AnalyticsContext.Provider>
  );
}

/**
 * Emits a `$pageview` on every navigation. Kept separate + Suspense-wrapped by
 * the provider because it reads `useSearchParams()`, which opts its boundary
 * into dynamic rendering.
 */
function PageViewTracker({ analytics }: { analytics: Analytics }): null {
  // Manual pageview on navigation — Next App Router doesn't fire
  // posthog-js's history-based capture reliably.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!pathname) return;
    const query = searchParams?.toString();
    analytics.page({
      $pathname: pathname,
      $search: query ? `?${query}` : undefined,
    });
  }, [analytics, pathname, searchParams]);
  return null;
}

/**
 * Read the client-side analytics surface anywhere under `AnalyticsProvider`.
 * Outside a provider this returns a noop — never throws.
 */
export function useAnalytics(): Analytics {
  const ctx = useContext(AnalyticsContext);
  return ctx ?? NOOP;
}

const NOOP: Analytics = {
  track() {},
  page() {},
  identify() {},
  reset() {},
};

export type {
  Analytics,
  AnalyticsEvent,
  BaseProperties,
  EventProperties,
  ProviderConfig,
} from "./types";
