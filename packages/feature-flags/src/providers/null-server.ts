import type { FlagsLogger, FlagsStrategy, FlagValue } from "../types";

/**
 * Noop strategy. Default in dev so flags evaluate to whatever default
 * the caller supplies (no network). Logs at `debug` for visibility.
 */
export class NullStrategy implements FlagsStrategy {
  readonly name = "null";
  readonly #logger?: FlagsLogger;

  constructor(opts: { logger?: FlagsLogger } = {}) {
    this.#logger = opts.logger;
  }

  async isEnabled(args: { distinctId: string; key: string }): Promise<undefined> {
    this.#logger?.debug({ ...args, provider: this.name }, "flags.isEnabled");
    return undefined;
  }

  async getValue(args: { distinctId: string; key: string }): Promise<undefined> {
    this.#logger?.debug({ ...args, provider: this.name }, "flags.getValue");
    return undefined;
  }

  async getAllFlags(_args: { distinctId: string }): Promise<Record<string, FlagValue>> {
    return {};
  }

  async shutdown(): Promise<void> {}
}
