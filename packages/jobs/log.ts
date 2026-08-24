import {
  type ChannelConfig,
  LogManager,
  type LogLevel,
} from "@saas/log";

const LOG_LEVELS: ReadonlySet<LogLevel> = new Set([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent",
]);

const VALID_CHANNELS = new Set([
  "pino",
  "better-stack",
  "console",
  "silent",
] as const);
type Channel = typeof VALID_CHANNELS extends Set<infer T> ? T : never;

// Per-service tokens take precedence (each Better Stack source has its
// own ingest URL + token), with the generic vars as a fallback for
// single-service setups.
const sourceToken =
  process.env.BETTER_STACK_SOURCE_TOKEN_JOBS ?? process.env.BETTER_STACK_SOURCE_TOKEN;
const host =
  process.env.BETTER_STACK_INGESTING_HOST_JOBS ?? process.env.BETTER_STACK_INGESTING_HOST;

const channels: Record<Channel, ChannelConfig> = {
  pino: { channel: "pino" },
  console: { channel: "console" },
  silent: { channel: "silent" },
  ...(sourceToken && {
    "better-stack": {
      channel: "better-stack" as const,
      sourceToken,
      ...(host && { host }),
    },
  }),
} as Record<Channel, ChannelConfig>;

const overrideChannel = process.env.LOG_CHANNEL;
const defaultChannel: Channel =
  overrideChannel && VALID_CHANNELS.has(overrideChannel as Channel) && channels[overrideChannel as Channel]
    ? (overrideChannel as Channel)
    : sourceToken
      ? "better-stack"
      : "pino";

const minLevel: LogLevel = LOG_LEVELS.has(process.env.LOG_LEVEL as LogLevel)
  ? (process.env.LOG_LEVEL as LogLevel)
  : "info";

/**
 * Trigger.dev tasks should keep using `@trigger.dev/sdk/v3#logger` for
 * the dashboard UI. Use this `log` for cross-cutting concerns (mirrors
 * to Better Stack via the configured channel) — typically inside shared
 * helpers or for fatal/cron-level events you want in the central sink.
 */
export const logManager = new LogManager({
  default: defaultChannel,
  channels,
  minLevel,
  baseBindings: {
    service: "jobs",
    env: process.env.NODE_ENV ?? "development",
  },
});

export const log = logManager.logger();
