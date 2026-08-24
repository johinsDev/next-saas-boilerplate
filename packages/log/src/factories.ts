import { LogManager } from "./log-manager";
import type {
  ChannelConfig,
  LogBindings,
  LogLevel,
  LogManagerConfig,
  LogRecord,
} from "./types";

let recordCounter = 0;

/**
 * Build a deterministic LogRecord for tests. Counter-based so equality
 * assertions stay stable; pass overrides for the fields you actually
 * care about.
 *
 * ```ts
 * fakeRecord({ level: "error", msg: "boom", bindings: { userId: "u1" } });
 * ```
 */
export function fakeRecord(overrides: Partial<LogRecord> = {}): LogRecord {
  recordCounter += 1;
  return {
    level: overrides.level ?? "info",
    time: overrides.time ?? Date.UTC(2026, 0, 1, 0, 0, 0, 0) + recordCounter,
    bindings: overrides.bindings ?? {},
    ...(overrides.msg !== undefined && { msg: overrides.msg }),
    ...(overrides.err && { err: overrides.err }),
  };
}

/**
 * Creates a LogManager pre-wired with `silent` as default + `console`
 * channel registered. Use in tests when you want a real manager but no
 * stdout noise; flip to fake with `manager.fake()` when you need asserts.
 */
export function fakeManager(
  overrides: Partial<LogManagerConfig<Record<string, ChannelConfig>>> = {},
): LogManager<Record<string, ChannelConfig>> {
  return new LogManager({
    default: "silent",
    channels: {
      silent: { channel: "silent" },
      console: { channel: "console", pretty: false },
    },
    minLevel: "trace",
    ...overrides,
  });
}

/**
 * Reset the deterministic counter — call from `beforeEach` if a test
 * cares about exact `time` values.
 */
export function resetFakeRecordCounter(): void {
  recordCounter = 0;
}

export type FakeRecordOverrides = Partial<LogRecord> & {
  bindings?: LogBindings;
  level?: LogLevel;
};
