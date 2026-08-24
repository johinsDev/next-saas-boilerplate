import type {
  BetterStackChannelConfig,
  LogLevel,
  LogRecord,
  LogTransport,
} from "../types";

export type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; statusText: string }>;

interface BetterStackTransportOptions {
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
  fetch?: FetchLike;
  /** Override `setTimeout` — used in tests. */
  setTimeout?: (handler: () => void, ms: number) => unknown;
  /** Override `clearTimeout` — used in tests. */
  clearTimeout?: (handle: unknown) => void;
}

interface SerializedRecord {
  dt: string;
  level: LogLevel;
  msg?: string;
  err?: { name: string; message: string; stack?: string };
  [key: string]: unknown;
}

/**
 * Streams `LogRecord`s to Better Stack Logs (formerly Logtail). Records
 * are buffered and flushed in batches to keep the hot path cheap.
 *
 * The constructor lets tests inject `fetch` and timer functions to make
 * the batching/retry logic deterministic.
 */
export class BetterStackTransport implements LogTransport {
  readonly name = "better-stack";
  readonly #endpoint: string;
  readonly #sourceToken: string;
  readonly #batchSize: number;
  readonly #flushIntervalMs: number;
  readonly #maxRetries: number;
  readonly #fetch: FetchLike;
  readonly #setTimeout: (handler: () => void, ms: number) => unknown;
  readonly #clearTimeout: (handle: unknown) => void;

  #buffer: SerializedRecord[] = [];
  #timer: unknown;
  #pending: Promise<void> = Promise.resolve();

  constructor(options: BetterStackTransportOptions | BetterStackChannelConfig) {
    const opts = "channel" in options ? optionsFromConfig(options) : options;
    this.#sourceToken = opts.sourceToken;
    const host = opts.host ?? "in.logs.betterstack.com";
    this.#endpoint = `https://${host}/`;
    this.#batchSize = opts.batchSize ?? 50;
    this.#flushIntervalMs = opts.flushIntervalMs ?? 5_000;
    this.#maxRetries = opts.maxRetries ?? 3;
    this.#fetch = opts.fetch ?? (globalThis.fetch as FetchLike);
    this.#setTimeout = opts.setTimeout ?? ((handler, ms) => globalThis.setTimeout(handler, ms));
    this.#clearTimeout = opts.clearTimeout ?? ((handle) => globalThis.clearTimeout(handle as Parameters<typeof globalThis.clearTimeout>[0]));
  }

  write(record: LogRecord): void {
    this.#buffer.push(serialize(record));

    if (this.#buffer.length >= this.#batchSize) {
      void this.#flush();
      return;
    }

    if (this.#timer === undefined) {
      this.#timer = this.#setTimeout(() => {
        this.#timer = undefined;
        void this.#flush();
      }, this.#flushIntervalMs);
    }
  }

  async flush(): Promise<void> {
    if (this.#timer !== undefined) {
      this.#clearTimeout(this.#timer);
      this.#timer = undefined;
    }
    await this.#flush();
    await this.#pending;
  }

  async #flush(): Promise<void> {
    if (this.#buffer.length === 0) return;

    const batch = this.#buffer;
    this.#buffer = [];

    const job = this.#post(batch).catch((err) => {
      // Last-ditch failure: don't crash the host process. Surface to
      // stderr so it shows up in the runtime logs.
      // biome-ignore lint/suspicious/noConsole: transport-level fallback
      console.error("[better-stack] dropped batch after retries:", err);
    });
    this.#pending = this.#pending.then(() => job);
    await job;
  }

  async #post(batch: SerializedRecord[]): Promise<void> {
    const body = JSON.stringify(batch);
    let attempt = 0;
    let delay = 250;

    while (true) {
      const res = await this.#fetch(this.#endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.#sourceToken}`,
        },
        body,
      });

      if (res.ok) return;

      const retriable = res.status >= 500 && res.status < 600;
      attempt += 1;
      if (!retriable || attempt > this.#maxRetries) {
        throw new Error(
          `better-stack ingest failed: ${res.status} ${res.statusText}`,
        );
      }

      await new Promise((resolve) => this.#setTimeout(resolve as () => void, delay));
      delay *= 2;
    }
  }
}

function optionsFromConfig(config: BetterStackChannelConfig): BetterStackTransportOptions {
  const out: BetterStackTransportOptions = { sourceToken: config.sourceToken };
  if (config.host !== undefined) out.host = config.host;
  if (config.batchSize !== undefined) out.batchSize = config.batchSize;
  if (config.flushIntervalMs !== undefined) out.flushIntervalMs = config.flushIntervalMs;
  if (config.maxRetries !== undefined) out.maxRetries = config.maxRetries;
  if (config.fetch) out.fetch = config.fetch as FetchLike;
  return out;
}

function serialize(record: LogRecord): SerializedRecord {
  const payload: SerializedRecord = {
    dt: new Date(record.time).toISOString(),
    level: record.level,
    ...record.bindings,
  };
  if (record.msg !== undefined) payload.msg = record.msg;
  if (record.err) {
    payload.err = {
      name: record.err.name,
      message: record.err.message,
      ...(record.err.stack && { stack: record.err.stack }),
    };
  }
  return payload;
}
