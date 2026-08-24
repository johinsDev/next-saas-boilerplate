import { endOfDay as endOfDayFns } from "date-fns/endOfDay";
import { isSameDay } from "date-fns/isSameDay";
import { parseISO } from "date-fns/parseISO";
import { startOfDay as startOfDayFns } from "date-fns/startOfDay";
import { subDays } from "date-fns/subDays";

/** True if `value` is a Date instance with a non-NaN timestamp. */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Permissive parser. Returns null for `null` / `undefined` / `""` / unparseable
 * strings, instead of the silent "Invalid Date" Date object you get from
 * `new Date(badInput)`. Use this at every boundary that hands a value off to
 * a formatter.
 *
 * **UTC footgun:** `parseDate("2026-05-11")` (date-only ISO) returns
 * midnight UTC, which in Bogotá (UTC-5) renders as the previous day's evening.
 * If you're parsing a pure date string and want local-midnight semantics,
 * parse it as `parseDate("2026-05-11T00:00:00")` instead.
 */
export function parseDate(input: unknown): Date | null {
  if (input === null || input === undefined || input === "") return null;
  if (input instanceof Date) return isValidDate(input) ? input : null;
  if (typeof input === "number") {
    const d = new Date(input);
    return isValidDate(d) ? d : null;
  }
  if (typeof input === "string") {
    const d = parseISO(input);
    return isValidDate(d) ? d : null;
  }
  return null;
}

export function isToday(date: Date, now: Date = new Date()): boolean {
  return isSameDay(date, now);
}

export function isYesterday(date: Date, now: Date = new Date()): boolean {
  return isSameDay(date, subDays(now, 1));
}

export const startOfDay = startOfDayFns;
export const endOfDay = endOfDayFns;
