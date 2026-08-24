import type { LogBindings, LogLevel, LogRecord, LogTransport } from "./types";

interface AssertCriteria {
  level?: LogLevel;
  msg?: string | RegExp;
  bindings?: LogBindings;
  err?: ErrorConstructor | { new (...args: never[]): Error };
}

function bindingsMatch(actual: LogBindings, expected: LogBindings): boolean {
  return Object.entries(expected).every(([key, value]) => actual[key] === value);
}

function recordMatches(record: LogRecord, criteria: AssertCriteria): boolean {
  if (criteria.level && record.level !== criteria.level) return false;
  if (criteria.msg !== undefined) {
    if (record.msg === undefined) return false;
    if (criteria.msg instanceof RegExp) {
      if (!criteria.msg.test(record.msg)) return false;
    } else if (record.msg !== criteria.msg) {
      return false;
    }
  }
  if (criteria.bindings && !bindingsMatch(record.bindings, criteria.bindings)) return false;
  if (criteria.err) {
    if (!record.err || !(record.err instanceof criteria.err)) return false;
  }
  return true;
}

/**
 * Captures every log record so tests can assert against them.
 * Use via `logManager.fake()` — never instantiate by hand in product code.
 */
export class FakeLogger implements LogTransport {
  readonly name = "fake";
  readonly records: LogRecord[] = [];

  write(record: LogRecord): void {
    this.records.push(record);
  }

  /** Drop captured state between assertions. */
  clear(): void {
    this.records.length = 0;
  }

  /** Records narrowed by level — handy for terse assertions. */
  recordsForLevel(level: LogLevel): LogRecord[] {
    return this.records.filter((r) => r.level === level);
  }

  assertLogged(criteria: AssertCriteria): this {
    if (!this.records.some((r) => recordMatches(r, criteria))) {
      throw new Error(
        `Expected a log record matching ${JSON.stringify(criteria)}, got ${this.records.length} records`,
      );
    }
    return this;
  }

  assertNotLogged(criteria: AssertCriteria): this {
    if (this.records.some((r) => recordMatches(r, criteria))) {
      throw new Error(
        `Did not expect a log record matching ${JSON.stringify(criteria)}, but found one`,
      );
    }
    return this;
  }

  assertLoggedCount(count: number): this;
  assertLoggedCount(criteria: AssertCriteria, count: number): this;
  assertLoggedCount(criteriaOrCount: AssertCriteria | number, count?: number): this {
    if (typeof criteriaOrCount === "number") {
      if (this.records.length !== criteriaOrCount) {
        throw new Error(
          `Expected ${criteriaOrCount} log records, got ${this.records.length}`,
        );
      }
      return this;
    }
    const actual = this.records.filter((r) => recordMatches(r, criteriaOrCount)).length;
    if (count !== undefined && actual !== count) {
      throw new Error(
        `Expected ${count} log records matching ${JSON.stringify(criteriaOrCount)}, got ${actual}`,
      );
    }
    return this;
  }

  assertNothingLogged(): this {
    if (this.records.length > 0) {
      const summary = this.records.map((r) => `${r.level}:${r.msg ?? ""}`).join(", ");
      throw new Error(`Expected no logs, got: ${summary}`);
    }
    return this;
  }
}
