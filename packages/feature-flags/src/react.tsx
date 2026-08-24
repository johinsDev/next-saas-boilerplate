"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { createFlags } from "./client";
import type { Flags, FlagKey, FlagValue, ProviderConfig } from "./types";

interface ProviderProps {
  /** Strategy: `"null"` (returns defaults) or `"posthog"`. */
  provider: ProviderConfig["provider"];
  /** PostHog project API key (`phc_…`). Ignored when provider is `"null"`. */
  apiKey?: string;
  /** PostHog host. Defaults to `https://us.i.posthog.com` on the client. */
  host?: string;
  children: ReactNode;
}

const FlagsContext = createContext<Flags | null>(null);

/**
 * Wrap once at the top of `providers.tsx`. Mount **inside** the
 * `<AnalyticsProvider>` if you use it — posthog-js's `init()` is
 * idempotent, but having analytics init first means `identify()` runs
 * before flags evaluate, so the distinctId matches between the two.
 */
export function FlagsProvider(props: ProviderProps): ReactNode {
  const config = useMemo<ProviderConfig>(() => {
    if (props.provider === "posthog" && props.apiKey) {
      return { provider: "posthog", apiKey: props.apiKey, host: props.host };
    }
    return { provider: "null" };
  }, [props.provider, props.apiKey, props.host]);

  const flagsRef = useRef<Flags | null>(null);
  if (!flagsRef.current) {
    flagsRef.current = createFlags({ provider: config });
  }

  return (
    <FlagsContext.Provider value={flagsRef.current}>
      {props.children}
    </FlagsContext.Provider>
  );
}

/**
 * Internal: read `flags` from context + subscribe to changes so the
 * consuming component re-renders when posthog's initial flag fetch
 * resolves (or when `reload()` is called).
 */
function useFlagsClient(): Flags | null {
  const flags = useContext(FlagsContext);
  const [, forceRender] = useState(0);
  useEffect(() => {
    if (!flags) return;
    return flags.onChange(() => forceRender((n) => n + 1));
  }, [flags]);
  return flags;
}

/**
 * `true` while the flag (or its default) is enabled. Outside a provider
 * the hook returns the supplied default — never throws.
 */
export function useIsFeatureEnabled(key: FlagKey, defaultValue = false): boolean {
  const flags = useFlagsClient();
  if (!flags) return defaultValue;
  return flags.isEnabled(key, defaultValue);
}

/**
 * Returns the multi-variant value (string | boolean) for the flag, or
 * the supplied default. Use this for A-B experiments where the flag is
 * configured to return a variant name.
 */
export function useFeatureFlag(key: FlagKey, defaultValue?: FlagValue): FlagValue {
  const flags = useFlagsClient();
  if (!flags) return defaultValue ?? false;
  return flags.getValue(key, defaultValue);
}

/**
 * `true` once posthog's initial flag fetch has resolved (or
 * immediately, for the `null` provider). Use to delay a render until
 * real flag values are available instead of flashing the default.
 */
export function useFlagsLoaded(): boolean {
  const flags = useFlagsClient();
  return useSyncExternalStore(
    (cb) => (flags ? flags.onChange(cb) : () => {}),
    () => (flags ? flags.isLoaded() : true),
    () => true,
  );
}

export type { Flags, FlagKey, FlagValue, ProviderConfig } from "./types";
