/** Calendar arithmetic behind `DateWheelPicker`, kept pure so it can be tested. */

export type DateValue = { day: number; month: number; year: number };

/** Which wheel is which, and the order they are laid out in. */
export type DateField = "day" | "month" | "year";

export const DEFAULT_FIELD_ORDER: readonly DateField[] = [
  "day",
  "month",
  "year",
];

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** Days in a 1-12 `month` of `year`, leap years included. */
export function daysInMonth(month: number, year: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(year, clamp(month, 1, 12), 0).getDate();
}

/** <0 when `a` is earlier than `b`, 0 when equal, >0 when later. */
export function compareDate(a: DateValue, b: DateValue): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function toDate(value: DateValue): Date {
  return new Date(value.year, value.month - 1, value.day);
}

export function fromDate(date: Date): DateValue {
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

/**
 * Inclusive month bounds for `year`. Only the boundary years are constrained —
 * pick 1994 out of a 1990…2026 range and every month is available; pick 2026
 * when `max` is 2026-08-03 and the wheel stops at August.
 */
export function monthBounds(
  year: number,
  min: DateValue,
  max: DateValue,
): [number, number] {
  return [year === min.year ? min.month : 1, year === max.year ? max.month : 12];
}

/** Inclusive day bounds for `year`/`month`, respecting both ends and leap days. */
export function dayBounds(
  year: number,
  month: number,
  min: DateValue,
  max: DateValue,
): [number, number] {
  const lo = year === min.year && month === min.month ? min.day : 1;
  const hi =
    year === max.year && month === max.month
      ? max.day
      : daysInMonth(month, year);
  return [lo, hi];
}

export function range(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) out.push(n);
  return out;
}

/**
 * Snap `value` into `[min, max]` one wheel at a time — year, then month, then
 * day. Field-wise is what a three-wheel picker needs: scrolling the year wheel
 * to 2026 when `max` is 2026-08-03 must pull December back to August rather
 * than rewrite the whole date. It always lands on a real, in-range day, so
 * 31 January → February becomes the 28th (or 29th in a leap year).
 */
export function normalizeDate(
  value: DateValue,
  min: DateValue,
  max: DateValue,
): DateValue {
  const year = clamp(value.year, min.year, max.year);
  const [monthLo, monthHi] = monthBounds(year, min, max);
  const month = clamp(value.month, monthLo, monthHi);
  const [dayLo, dayHi] = dayBounds(year, month, min, max);
  const day = clamp(value.day, dayLo, dayHi);
  return { day, month, year };
}

/** True when both dates name the same calendar day. */
export function sameDate(a: DateValue, b: DateValue): boolean {
  return compareDate(a, b) === 0;
}

/**
 * Resolve the effective `[min, max]` window from the props. `minDate`/`maxDate`
 * win; otherwise the year bounds widen to whole years, except that an unbounded
 * upper end stops at `today` — a birth date in the future is never valid, and
 * every caller of this component picks one.
 */
export function resolveBounds(options: {
  minYear?: number;
  maxYear?: number;
  minDate?: DateValue;
  maxDate?: DateValue;
  today: DateValue;
}): { min: DateValue; max: DateValue } {
  const { minYear = 1925, maxYear, minDate, maxDate, today } = options;
  const min = minDate ?? { day: 1, month: 1, year: minYear };
  const max =
    maxDate ??
    (maxYear === undefined
      ? today
      : { day: daysInMonth(12, maxYear), month: 12, year: maxYear });
  // A caller that inverts the window would otherwise produce empty wheels.
  return compareDate(min, max) > 0 ? { min: max, max: min } : { min, max };
}
