import type { ConsoleChannelConfig, LogLevel, LogRecord, LogTransport } from "../types";

const LEVEL_COLOR: Record<LogLevel, string> = {
  trace: "\x1b[90m", // gray
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m", // green
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  fatal: "\x1b[35m", // magenta
  silent: "",
};
const RESET = "\x1b[0m";

const LEVEL_TO_METHOD: Record<LogLevel, "log" | "info" | "warn" | "error"> = {
  trace: "log",
  debug: "log",
  info: "info",
  warn: "warn",
  error: "error",
  fatal: "error",
  silent: "log",
};

/**
 * Plain `console.*` sink. Handy for the browser, edge runtimes, or
 * any environment where Pino's worker model adds friction. Pretty mode
 * adds ANSI colors and a one-line preamble; off, it emits a JSON object
 * per record so logs stay greppable.
 */
export class ConsoleTransport implements LogTransport {
  readonly name = "console";
  readonly #pretty: boolean;

  constructor(config: ConsoleChannelConfig = { channel: "console" }) {
    this.#pretty = config.pretty ?? process.env.NODE_ENV !== "production";
  }

  write(record: LogRecord): void {
    const method = LEVEL_TO_METHOD[record.level];
    if (this.#pretty) {
      // biome-ignore lint/suspicious/noConsole: this transport is the console
      console[method](this.#formatPretty(record));
      return;
    }
    // biome-ignore lint/suspicious/noConsole: this transport is the console
    console[method](this.#formatJson(record));
  }

  #formatPretty(record: LogRecord): string {
    const color = LEVEL_COLOR[record.level];
    const time = new Date(record.time).toISOString();
    const head = `${color}${record.level.toUpperCase().padEnd(5)}${RESET} ${time}`;
    const msg = record.msg ?? "";
    const bindings = Object.keys(record.bindings).length
      ? ` ${JSON.stringify(record.bindings)}`
      : "";
    const err = record.err ? `\n${record.err.stack ?? record.err.message}` : "";
    return `${head} ${msg}${bindings}${err}`;
  }

  #formatJson(record: LogRecord): string {
    const payload: Record<string, unknown> = {
      level: record.level,
      time: record.time,
      ...record.bindings,
    };
    if (record.msg !== undefined) payload.msg = record.msg;
    if (record.err) {
      payload.err = {
        type: record.err.name,
        message: record.err.message,
        stack: record.err.stack,
      };
    }
    return JSON.stringify(payload);
  }
}
