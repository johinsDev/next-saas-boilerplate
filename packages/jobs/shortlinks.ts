import { createShortlinkStore, ShortlinkRepository } from "@saas/services";
import { db } from "@saas/db";
import { ShortlinksManager } from "@saas/shortlinks";

import { env } from "./env";
import { log } from "./log";

/**
 * Shortlinks bootstrap for Trigger.dev tasks. `custom` (self-hosted, served by
 * the API Worker) when a short host is configured — preview/prod; otherwise
 * `null` (passthrough, dev), so `{{short_link}}` renders the raw URL locally.
 *
 * Lazy: built on first use so `trigger deploy` can index task files with no env.
 */
function build() {
  const baseUrl = env.SHORTLINK_BASE_URL;
  const useCustom = Boolean(baseUrl) && (env.SHORTLINKS_PROVIDER ?? "custom") === "custom";
  if (useCustom && baseUrl) {
    return new ShortlinksManager({
      default: "custom",
      providers: {
        custom: {
          provider: "custom",
          store: createShortlinkStore(new ShortlinkRepository(db)),
          baseUrl,
          logger: log,
        },
      },
    });
  }
  return new ShortlinksManager({
    default: "null",
    providers: { null: { provider: "null" } },
  });
}

let cached: ReturnType<typeof build> | undefined;

export const shortlinks = new Proxy({} as ReturnType<typeof build>, {
  get(_target, prop) {
    cached ??= build();
    const value = (cached as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(cached) : value;
  },
});
