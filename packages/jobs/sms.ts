import { db } from "@saas/db";
import { SmsManager, type ProviderConfig } from "@saas/sms";

import { env } from "./env";
import { log } from "./log";

/**
 * Bootstrap for `@saas/sms` inside Trigger.dev tasks. Same policy as the
 * apps: log locally, outbox in preview, twilio in prod.
 *
 * Lazy: built on first use so `trigger deploy` can index task files with no
 * env present.
 */
function pickDefaultProvider(): "log" | "outbox" | "twilio" {
  if (env.SMS_PROVIDER && env.SMS_PROVIDER !== "folder") {
    return env.SMS_PROVIDER;
  }
  if (process.env.VERCEL_ENV === "production") return "twilio";
  if (process.env.VERCEL_ENV === "preview") return "outbox";
  return "log";
}

function build() {
  const twilioConfig: ProviderConfig | undefined =
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_SMS_FROM
      ? {
          provider: "twilio",
          accountSid: env.TWILIO_ACCOUNT_SID,
          authToken: env.TWILIO_AUTH_TOKEN,
          from: env.TWILIO_SMS_FROM,
        }
      : undefined;

  return new SmsManager({
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

export const sms = new Proxy({} as ReturnType<typeof build>, {
  get(_target, prop) {
    cached ??= build();
    const value = (cached as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(cached) : value;
  },
});
