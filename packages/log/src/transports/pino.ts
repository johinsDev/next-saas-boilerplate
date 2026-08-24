import type { LogLevel, LogRecord, LogTransport, PinoChannelConfig } from "../types";

interface PinoLikeLogger {
  trace(obj: object, msg?: string): void;
  debug(obj: object, msg?: string): void;
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
  fatal(obj: object, msg?: string): void;
  flush?(): void;
}

type PinoFactory = (options?: Record<string, unknown>) => PinoLikeLogger;

/**
 * Pino-backed transport. The Pino instance is loaded lazily so this
 * package doesn't force a heavy dependency on consumers that only need
 * `silent` or `console` (e.g. browsers, light edge functions).
 *
 * Inject a custom `instance` (or pass it via `PinoChannelConfig.instance`)
 * to use a pre-built logger — handy for tests and for serverless setups
 * that share a single instance across invocations.
 */
export class PinoTransport implements LogTransport {
  readonly name = "pino";
  readonly #options: Record<string, unknown>;
  #pino?: PinoLikeLogger;
  #factory?: PinoFactory;

  constructor(config: PinoChannelConfig = { channel: "pino" }) {
    this.#options = config.options ?? {};
    if (config.instance) {
      this.#pino = config.instance as PinoLikeLogger;
    }
  }

  /**
   * Override the Pino factory used to build the lazy instance. Tests
   * use this to inject a stub without going through dynamic import.
   */
  setFactory(factory: PinoFactory): void {
    this.#factory = factory;
    this.#pino = undefined;
  }

  async write(record: LogRecord): Promise<void> {
    const pino = await this.#getInstance();
    const payload: Record<string, unknown> = { ...record.bindings };
    if (record.err) {
      payload.err = record.err;
    }

    const method = record.level === "silent" ? "info" : (record.level as Exclude<LogLevel, "silent">);
    pino[method](payload, record.msg);
  }

  async flush(): Promise<void> {
    const pino = this.#pino;
    if (pino?.flush) {
      pino.flush();
    }
  }

  async #getInstance(): Promise<PinoLikeLogger> {
    if (this.#pino) return this.#pino;
    if (this.#factory) {
      this.#pino = this.#factory(this.#options);
      return this.#pino;
    }
    const mod = (await import("pino")) as { default: PinoFactory } | PinoFactory;
    const factory = (typeof mod === "function" ? mod : mod.default) as PinoFactory;
    this.#pino = factory(this.#options);
    return this.#pino;
  }
}
