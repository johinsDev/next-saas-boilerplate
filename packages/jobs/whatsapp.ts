import { db } from "@saas/db";
import { WhatsAppManager, type ProviderConfig } from "@saas/whatsapp";

import { env } from "./env";
import { log } from "./log";

/**
 * Bootstrap for `@saas/whatsapp` in Trigger.dev tasks. Same policy
 * as the apps: log locally, outbox in preview, twilio in prod.
 *
 * Lazy: the manager (which reads the validated `env`) is built on first use,
 * not at import — so `trigger deploy` can index task files with no env present.
 */
function pickDefaultProvider(): "log" | "outbox" | "twilio" {
  if (env.WHATSAPP_PROVIDER) return env.WHATSAPP_PROVIDER;
  if (process.env.VERCEL_ENV === "production") return "twilio";
  if (process.env.VERCEL_ENV === "preview") return "outbox";
  return "log";
}

function build() {
  const twilioConfig: ProviderConfig | undefined =
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM
      ? {
          provider: "twilio",
          accountSid: env.TWILIO_ACCOUNT_SID,
          authToken: env.TWILIO_AUTH_TOKEN,
          from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
        }
      : undefined;

  return new WhatsAppManager({
    default: pickDefaultProvider(),
    mailers: {
      log: { provider: "log", logger: log },
      outbox: { provider: "outbox", db },
      twilio: twilioConfig,
    },
    logger: log,
  });
}

let cached: ReturnType<typeof build> | undefined;

export const whatsapp = new Proxy({} as ReturnType<typeof build>, {
  get(_target, prop) {
    cached ??= build();
    const value = (cached as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(cached) : value;
  },
});
