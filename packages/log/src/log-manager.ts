import { UnknownChannelError } from "./errors";
import { FakeLogger } from "./fake-logger";
import { Logger } from "./logger";
import { BetterStackTransport } from "./transports/better-stack";
import { ConsoleTransport } from "./transports/console";
import { PinoTransport } from "./transports/pino";
import { SilentTransport } from "./transports/silent";
import type {
  ChannelConfig,
  LogBindings,
  LogLevel,
  LogManagerConfig,
  LogTransport,
} from "./types";

function createTransport(config: ChannelConfig): LogTransport {
  switch (config.channel) {
    case "pino":
      return new PinoTransport(config);
    case "console":
      return new ConsoleTransport(config);
    case "silent":
      return new SilentTransport();
    case "better-stack":
      return new BetterStackTransport(config);
  }
}

/**
 * LogManager owns the channel registry, caches `Logger` instances, and
 * exposes `fake()` for tests. Designed to be a process-wide singleton —
 * each app instantiates one in its bootstrap and re-exports it.
 *
 * ```ts
 * const logManager = new LogManager({
 *   default: "pino",
 *   channels: {
 *     pino: { channel: "pino", options: { level: "info" } },
 *     console: { channel: "console" },
 *     silent: { channel: "silent" },
 *   },
 *   minLevel: "info",
 *   baseBindings: { service: "admin" },
 * });
 *
 * logManager.logger().info({ userId: "1" }, "signed in");
 * logManager.use("console").error("emergency");
 * logManager.setDefault("console"); // swap at runtime
 * ```
 */
export class LogManager<TChannels extends Record<string, ChannelConfig>> {
  readonly #config: LogManagerConfig<TChannels>;
  readonly #cache = new Map<string, Logger>();
  #default: keyof TChannels & string;
  #minLevel: LogLevel;
  #baseBindings: LogBindings;
  #fake?: FakeLogger;

  constructor(config: LogManagerConfig<TChannels>) {
    this.#config = config;
    this.#default = config.default;
    this.#minLevel = config.minLevel ?? "info";
    this.#baseBindings = config.baseBindings ?? {};
  }

  /** Logger backed by the default channel — re-resolved on every call so
   * `setDefault()` takes effect immediately. */
  logger(bindings?: LogBindings): Logger {
    const base = this.use();
    return bindings ? base.child(bindings) : base;
  }

  /** Get a Logger for a specific channel (or the default). When fake mode is
   * active every call returns the fake logger, no matter the name. */
  use<K extends keyof TChannels & string>(channel?: K): Logger {
    const name = channel ?? this.#default;

    if (!this.#config.channels[name]) {
      throw new UnknownChannelError(name);
    }

    if (this.#fake) {
      return this.#wrap(name, this.#fake);
    }

    const cached = this.#cache.get(name);
    if (cached) return cached;

    const transport = createTransport(this.#config.channels[name]);
    const logger = this.#wrap(name, transport);
    this.#cache.set(name, logger);
    return logger;
  }

  /** Swap the active channel without recreating the manager. The cache is
   * preserved so the previous channel's loggers remain reusable. */
  setDefault<K extends keyof TChannels & string>(channel: K): void {
    if (!this.#config.channels[channel]) {
      throw new UnknownChannelError(channel);
    }
    this.#default = channel;
  }

  /** Mutates the floor for in-memory filtering across all channels. */
  setMinLevel(level: LogLevel): void {
    this.#minLevel = level;
    this.#cache.clear();
  }

  /** Replace the always-on bindings; clears the cache so next `use()` rebuilds. */
  setBaseBindings(bindings: LogBindings): void {
    this.#baseBindings = bindings;
    this.#cache.clear();
  }

  /** Enables fake mode: every Logger handed out from now on is the FakeLogger. */
  fake(): FakeLogger {
    this.restore();
    this.#fake = new FakeLogger();
    return this.#fake;
  }

  /** Disables fake mode and clears the cache so real transports rebuild on next use. */
  restore(): void {
    if (this.#fake) {
      this.#fake = undefined;
      this.#cache.clear();
    }
  }

  /** Names of all configured channels — useful in admin tooling. */
  channels(): string[] {
    return Object.keys(this.#config.channels);
  }

  #wrap(name: string, transport: LogTransport): Logger {
    return new Logger({
      channel: name,
      transport,
      minLevel: this.#minLevel,
      bindings: this.#baseBindings,
      // Lets call sites do `log.use("audit").info(...)` to route a
      // single record through a specific channel without going through
      // the manager directly.
      resolveChannel: (channelName) =>
        this.use(channelName as keyof TChannels & string),
    });
  }
}
