import { PushTokenRepository } from "@saas/services/push-tokens";
import { db, getPrimaryOrganizationId } from "@saas/db";
import {
  PushManager,
  type ProviderConfig,
  type PushPlatform,
} from "@saas/push";

import { env } from "./env";
import { log } from "./log";

/**
 * Bootstrap for `@saas/push` inside Trigger.dev tasks. Mirrors the
 * shape of `apps/{web,admin}/src/lib/push.ts` — same provider cascade,
 * same `tokenLookup` for the `auto` mode that fans out web push vs
 * Expo per device.
 *
 * Defaults: log locally, outbox in preview, auto in prod.
 *
 * Lazy: the manager (which reads the validated `env`) is built on first use,
 * not at import — so `trigger deploy` can index task files with no env present.
 */
function pickDefaultProvider(): "log" | "outbox" | "webpush" | "expo" | "auto" {
  if (env.PUSH_PROVIDER) return env.PUSH_PROVIDER;
  if (process.env.VERCEL_ENV === "production") return "auto";
  if (process.env.VERCEL_ENV === "preview") return "outbox";
  return "log";
}

const tokenRepo = new PushTokenRepository(db);
async function tokenLookup(
  userId: string,
): Promise<Array<{ token: string; platform: PushPlatform }>> {
  const rows = await tokenRepo.listActiveForCustomer(
    userId,
    (await getPrimaryOrganizationId()) ?? "",
  );
  return rows.map((r) => ({
    token: r.token,
    platform: r.platform as PushPlatform,
  }));
}

function build() {
  const webpushConfig: ProviderConfig | undefined =
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
      ? {
          provider: "webpush",
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
          subject: env.VAPID_SUBJECT,
        }
      : undefined;

  const expoConfig: ProviderConfig = {
    provider: "expo",
    ...(env.EXPO_ACCESS_TOKEN && { accessToken: env.EXPO_ACCESS_TOKEN }),
  };

  const autoConfig: ProviderConfig | undefined =
    webpushConfig?.provider === "webpush"
      ? {
          provider: "auto",
          webpush: webpushConfig,
          expo: expoConfig,
          tokenLookup,
        }
      : undefined;

  return new PushManager({
    default: pickDefaultProvider(),
    senders: {
      log: { provider: "log", logger: log },
      outbox: { provider: "outbox", db },
      webpush: webpushConfig,
      expo: expoConfig,
      auto: autoConfig,
    },
    // Applied to every sender so `toUser(...)` resolves device tokens even
    // under the log/outbox providers (not just `auto`).
    tokenLookup,
    logger: log,
  });
}

let cached: ReturnType<typeof build> | undefined;

export const push = new Proxy({} as ReturnType<typeof build>, {
  get(_target, prop) {
    cached ??= build();
    const value = (cached as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(cached) : value;
  },
});

export { tokenLookup };
