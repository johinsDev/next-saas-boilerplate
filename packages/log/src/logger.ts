import {
  LOG_LEVELS,
  type LogBindings,
  type LogLevel,
  type LogRecord,
  type LogTransport,
} from "./types";

interface LoggerOptions {
  channel: string;
  transport: LogTransport;
  minLevel: LogLevel;
  bindings?: LogBindings;
  /** Provided by LogManager so `logger.use("name")` resolves to a sibling
   *  Logger. Loggers built outside a manager will throw on `.use()`. */
  resolveChannel?: (channel: string) => Logger;
}

/**
 * Operational logger handed out by the manager. Wraps a single transport
 * and applies the active level filter + bindings before writing.
 *
 * Cheap to construct (no async work in `child()` / `use()`), so build
 * short-lived children freely for request scopes, jobs, etc.
 */
export class Logger {
  readonly channel: string;
  readonly #transport: LogTransport;
  readonly #minLevel: LogLevel;
  readonly #bindings: LogBindings;
  readonly #resolveChannel?: (channel: string) => Logger;

  constructor(options: LoggerOptions) {
    this.channel = options.channel;
    this.#transport = options.transport;
    this.#minLevel = options.minLevel;
    this.#bindings = options.bindings ?? {};
    this.#resolveChannel = options.resolveChannel;
  }

  /** Returns a new Logger with the supplied bindings merged into every record. */
  child(bindings: LogBindings): Logger {
    return new Logger({
      channel: this.channel,
      transport: this.#transport,
      minLevel: this.#minLevel,
      bindings: { ...this.#bindings, ...bindings },
      ...(this.#resolveChannel && { resolveChannel: this.#resolveChannel }),
    });
  }

  /**
   * Returns a sibling Logger backed by a different channel. Useful when a
   * call site wants to ship a record through a specific transport
   * regardless of the manager's default — for example
   * `log.use("audit").info(...)` to route audit logs to a dedicated source.
   *
   * Inherits the manager's base bindings, NOT this logger's call-time
   * bindings. Add bindings on top with `.child(...)`:
   *   log.use("audit").child({ requestId }).info(...)
   *
   * Throws if the Logger was constructed outside a LogManager (no resolver).
   */
  use(channel: string): Logger {
    if (!this.#resolveChannel) {
      throw new Error(
        "Logger.use() requires a LogManager. This logger was constructed standalone.",
      );
    }
    return this.#resolveChannel(channel);
  }

  trace(msgOrBindings?: string | LogBindings, msg?: string): void {
    this.#log("trace", msgOrBindings, msg);
  }

  debug(msgOrBindings?: string | LogBindings, msg?: string): void {
    this.#log("debug", msgOrBindings, msg);
  }

  info(msgOrBindings?: string | LogBindings, msg?: string): void {
    this.#log("info", msgOrBindings, msg);
  }

  warn(msgOrBindings?: string | LogBindings, msg?: string): void {
    this.#log("warn", msgOrBindings, msg);
  }

  error(msgOrBindings?: string | LogBindings | Error, msg?: string): void {
    this.#log("error", msgOrBindings, msg);
  }

  fatal(msgOrBindings?: string | LogBindings | Error, msg?: string): void {
    this.#log("fatal", msgOrBindings, msg);
  }

  flush(): void | Promise<void> {
    return this.#transport.flush?.();
  }

  #log(
    level: LogLevel,
    msgOrBindings?: string | LogBindings | Error,
    explicitMsg?: string,
  ): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.#minLevel]) return;

    let msg: string | undefined;
    let extra: LogBindings | undefined;
    let err: Error | undefined;

    if (msgOrBindings instanceof Error) {
      err = msgOrBindings;
      msg = explicitMsg ?? msgOrBindings.message;
    } else if (typeof msgOrBindings === "string") {
      msg = msgOrBindings;
    } else if (msgOrBindings !== undefined) {
      extra = msgOrBindings;
      msg = explicitMsg;
      const maybeErr = msgOrBindings.err;
      if (maybeErr instanceof Error) {
        err = maybeErr;
      }
    }

    const record: LogRecord = {
      level,
      time: Date.now(),
      bindings: extra ? { ...this.#bindings, ...extra } : this.#bindings,
      ...(msg !== undefined && { msg }),
      ...(err && { err }),
    };

    void this.#transport.write(record);
  }
}
