import {
  additionalPackages,
  syncEnvVars,
} from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk/v3";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// `trigger dev` evaluates this file in place, so the monorepo .env
// (two levels up) is loadable and gives tasks DATABASE_URL etc.
//
// `trigger deploy` bundles + evaluates the config inside an isolated
// sandbox where `import.meta.url` is `file:///trigger.config.ts` and
// the relative `../../.env` resolves to nothing — dotenv loads 0 vars.
// That's expected: on deploy, env comes from the Trigger.dev project
// dashboard, not the repo .env. So the load is best-effort and must
// never throw, and the project ref must NOT depend on it.
//
// The project ref (`proj_…`) is a public identifier (it shows up in
// build logs + the AI-help URLs), not a secret — safe to hardcode as
// the fallback so config evaluation survives the deploy sandbox.
const TRIGGER_PROJECT_REF = "proj_pwqxhdhrlurljnctiqdz";

try {
  const here = dirname(fileURLToPath(import.meta.url));

  // `override: false`: only fill vars NOT already in the environment. Jobs
  // runs under `with-infisical` (Infisical is the source of truth), which
  // injects the full env before this config evaluates — so the injected
  // values must win. A stale value in the repo `.env` (e.g. an empty
  // `SMS_PROVIDER`, or a leftover remote `DATABASE_URL`) must NOT clobber
  // them, or jobs silently diverges from the apps: wrong DB, wrong provider
  // (sms/push falling back to `log` instead of `outbox`), etc. `.env` still
  // fills anything Infisical didn't provide, so a bare `trigger dev` (no
  // Infisical) keeps working. In the deploy sandbox the path resolves to
  // nothing, so this loads 0 vars regardless.
  loadEnv({ path: resolve(here, "../../.env"), override: false });
} catch {
  // No-op: deploy sandbox has no repo .env. Env is injected by the
  // Trigger.dev dashboard at runtime there.
}

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID ?? TRIGGER_PROJECT_REF,
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./trigger"],
  build: {
    // Mark every optional provider dep as external so esbuild stops
    // tracing the dynamic `await import("…")` chains in
    // @saas/{whatsapp,sms,cache,email,push}. They're only loaded
    // when the matching provider is selected at runtime; if a task
    // ever needs one, install it in this package so it resolves then.
    external: [
      "twilio",
      "ioredis",
      "@upstash/redis",
      "resend",
      "expo-server-sdk",
      "web-push",
    ],
    // On `trigger deploy`, push the deploy-time env (the GH Action injects the
    // per-PR DATABASE_URL + the Infisical staging base) into the Trigger
    // environment being deployed — so preview-branch tasks run against the
    // PR's masked DB. Replaces hand-setting vars in the Trigger dashboard.
    extensions: [
      // Provider SDKs are loaded via obfuscated dynamic import (so the
      // bundler doesn't trace them) + listed in `external`, so Trigger's
      // dependency detection prunes them and they're NOT installed in the
      // deploy. Force-install the ones a deployed task actually uses:
      // `web-push` for the push `webpush` provider (preview/prod) and
      // `resend` for the email `resend` provider (preview/prod). Add
      // twilio/expo-server-sdk here when prod selects those providers.
      additionalPackages({ packages: ["web-push@^3.6.7", "resend@^4.0.0"] }),
      syncEnvVars(() => {
        const keys = [
          "DATABASE_URL",
          "TURSO_AUTH_TOKEN",
          // Jobs transitively load @saas/auth (via the @saas/api
          // feature barrels), which instantiates Better Auth at import and
          // requires this — otherwise the run throws "default secret".
          "BETTER_AUTH_SECRET",
          "WHATSAPP_PROVIDER",
          "PUSH_PROVIDER",
          "TWILIO_ACCOUNT_SID",
          "TWILIO_AUTH_TOKEN",
          "TWILIO_WHATSAPP_FROM",
          "VAPID_PUBLIC_KEY",
          "VAPID_PRIVATE_KEY",
          "VAPID_SUBJECT",
          "EXPO_ACCESS_TOKEN",
          "EMAIL_PROVIDER",
          "RESEND_API_KEY",
          "EMAIL_FROM",
          "SMS_PROVIDER",
          "TWILIO_SMS_FROM",
          "PARTYKIT_HOST",
          "PARTYKIT_PROJECT",
          "REALTIME_AUTH_SECRET",
          "REALTIME_ROOM_PREFIX",
          "LOG_CHANNEL",
          "LOG_LEVEL",
          "BETTER_STACK_SOURCE_TOKEN_JOBS",
          "BETTER_STACK_INGESTING_HOST_JOBS",
          "OUTBOX_RETENTION_DAYS",
        ];
        return keys
          .filter((k) => process.env[k])
          .map((k) => ({ name: k, value: process.env[k] as string }));
      }),
    ],
  },
});
