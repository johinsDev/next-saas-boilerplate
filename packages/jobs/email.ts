import { db } from "@saas/db";
import { EmailManager, type ProviderConfig } from "@saas/email";

import { env } from "./env";
import { log } from "./log";

/**
 * Bootstrap for `@saas/email` inside Trigger.dev tasks. Same policy as the
 * apps: log locally, outbox in preview, resend in prod.
 *
 * Lazy: the manager (which reads the validated `env`) is built on first use,
 * not at import — so `trigger deploy` can index task files with no env present.
 */
/*
 * `folder` is honoured here for one reason: running the queue locally without a
 * provider account, so the worker writes a file you can open instead of
 * reaching for Resend. In a deployed worker that file lands on an ephemeral
 * container filesystem where nobody will ever see it — which is worse than a
 * log line, so do not select it there.
 */
function pickDefaultProvider(): "log" | "outbox" | "resend" | "folder" {
  if (env.EMAIL_PROVIDER) {
    return env.EMAIL_PROVIDER;
  }
  if (process.env.VERCEL_ENV === "production") return "resend";
  if (process.env.VERCEL_ENV === "preview") return "outbox";
  return "log";
}

function build() {
  const resendConfig: ProviderConfig | undefined = env.RESEND_API_KEY
    ? {
        provider: "resend",
        apiKey: env.RESEND_API_KEY,
        ...(env.EMAIL_FROM && { from: env.EMAIL_FROM }),
      }
    : undefined;

  return new EmailManager({
    default: pickDefaultProvider(),
    mailers: {
      log: { provider: "log", logger: log },
      // Local only — see `pickDefaultProvider`.
      folder: { provider: "folder", outputDir: ".email-previews", openInBrowser: true },
      outbox: { provider: "outbox", db },
      resend: resendConfig,
    },
    logger: log,
  });
}

let cached: ReturnType<typeof build> | undefined;

export const email = new Proxy({} as ReturnType<typeof build>, {
  get(_target, prop) {
    cached ??= build();
    const value = (cached as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(cached) : value;
  },
});
