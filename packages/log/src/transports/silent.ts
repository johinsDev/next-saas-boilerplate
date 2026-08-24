import type { LogTransport } from "../types";

/**
 * Drops every record. Useful as the default channel in tests so
 * unmocked code doesn't pollute output.
 */
export class SilentTransport implements LogTransport {
  readonly name = "silent";

  write(): void {
    // intentional no-op
  }
}
