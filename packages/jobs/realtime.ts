import { FakeRealtime, RealtimeClient } from "@saas/realtime";

import { env } from "./env";
import { log } from "./log";

/**
 * Bootstrap for `@saas/realtime` inside Trigger.dev tasks. Publishes events
 * into PartyKit rooms when configured, else falls back to `FakeRealtime` (a
 * no-op recorder) so local dev / unconfigured previews don't crash.
 *
 * Lazy: built on first use so `trigger deploy` can index task files with no
 * env present.
 */
const isLocalHost = (host: string | undefined) =>
  !!host && /^(127\.0\.0\.1|localhost)(:|$)/.test(host);

function build(): RealtimeClient | FakeRealtime {
  if (env.PARTYKIT_HOST && env.PARTYKIT_PROJECT && env.REALTIME_AUTH_SECRET) {
    return new RealtimeClient({
      host: env.PARTYKIT_HOST,
      project: env.PARTYKIT_PROJECT,
      secret: env.REALTIME_AUTH_SECRET,
      protocol: isLocalHost(env.PARTYKIT_HOST) ? "http" : "https",
      ...(env.REALTIME_ROOM_PREFIX && { roomPrefix: env.REALTIME_ROOM_PREFIX }),
    });
  }
  log.warn(
    { _service: "realtime" },
    "realtime not configured — using FakeRealtime; set PARTYKIT_HOST + PARTYKIT_PROJECT + REALTIME_AUTH_SECRET",
  );
  return new FakeRealtime();
}

let cached: RealtimeClient | FakeRealtime | undefined;

export const realtime = new Proxy({} as RealtimeClient | FakeRealtime, {
  get(_target, prop) {
    cached ??= build();
    const value = (cached as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(cached) : value;
  },
});
