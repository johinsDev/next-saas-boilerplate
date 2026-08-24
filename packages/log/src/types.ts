/**
 * Numeric levels follow Pino's convention so transports can compare
 * against `minLevel` cheaply: lower numbers are more verbose.
 */
export const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Number.POSITIVE_INFINITY,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;
export type LogLevelValue = (typeof LOG_LEVELS)[LogLevel];

/**
 * Structured fields attached to every log line. Channels like Pino
 * serialize this object directly. `msg` is conventional but optional —
 * a log can be just bindings + level.
 */
export interface LogBindings {
  [key: string]: unknown;
}

/**
 * The atomic unit a transport receives. Manager / Logger compose this
 * before handing it off so transports stay dumb and easy to swap.
 */
export interface LogRecord {
  level: LogLevel;
  time: number;
  msg?: string;
  bindings: LogBindings;
  err?: Error;
}

/**
 * What every concrete provider implements. `name` shows up in logs and
 * test failures, so keep it stable per provider.
 */
export interface LogTransport {
  readonly name: string;
  write(record: LogRecord): void | Promise<void>;
  /** Optional: flush buffered records (e.g. async sinks). */
  flush?(): void | Promise<void>;
}

export interface PinoChannelConfig {
  channel: "pino";
  /** Override Pino options (level, transport, formatters, etc.). */
  options?: Record<string, unknown>;
  /** Pre-built Pino instance — useful for tests or custom destinations. */
  instance?: unknown;
}

export interface ConsoleChannelConfig {
  channel: "console";
  /** Pretty-print JSON bindings (default: true in dev, false in prod). */
  pretty?: boolean;
}

export interface SilentChannelConfig {
  channel: "silent";
}

export interface BetterStackChannelConfig {
  channel: "better-stack";
  /** Source token from Better Stack -> Logs -> Sources. Required. */
  sourceToken: string;
  /** Ingest host. Defaults to `in.logs.betterstack.com`. */
  host?: string;
  /** Flush after this many buffered records. Defaults to 50. */
  batchSize?: number;
  /** Flush at most this often (ms). Defaults to 5_000. */
  flushIntervalMs?: number;
  /** Max retry attempts on 5xx. Defaults to 3. */
  maxRetries?: number;
  /** Override `fetch` — used in tests. */
  fetch?: unknown;
}

export type ChannelConfig =
  | PinoChannelConfig
  | ConsoleChannelConfig
  | SilentChannelConfig
  | BetterStackChannelConfig;

export interface LogManagerConfig<T extends Record<string, ChannelConfig>> {
  /** Name of the channel returned when `use()` is called without arguments. */
  default: keyof T & string;
  /** All available channels keyed by name. */
  channels: T;
  /** Drops records below this level before reaching transports. */
  minLevel?: LogLevel;
  /** Bindings merged into every record (e.g. `service`, `env`). */
  baseBindings?: LogBindings;
}
