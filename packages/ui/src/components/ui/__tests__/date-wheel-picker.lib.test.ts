import { describe, expect, it } from "vitest";

import {
  type DateValue,
  compareDate,
  dayBounds,
  daysInMonth,
  fromDate,
  monthBounds,
  normalizeDate,
  range,
  resolveBounds,
  sameDate,
  toDate,
} from "../date-wheel-picker.lib";

const d = (day: number, month: number, year: number): DateValue => ({
  day,
  month,
  year,
});

describe("daysInMonth", () => {
  it("covers every month of a common year", () => {
    const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (const [i, expected] of lengths.entries()) {
      expect(daysInMonth(i + 1, 2001)).toBe(expected);
    }
  });

  it("applies the full Gregorian leap rule to February", () => {
    expect(daysInMonth(2, 2024)).toBe(29); // divisible by 4
    expect(daysInMonth(2, 2023)).toBe(28);
    expect(daysInMonth(2, 1900)).toBe(28); // century, not divisible by 400
    expect(daysInMonth(2, 2000)).toBe(29); // divisible by 400
  });

  it("clamps an out-of-range month instead of rolling into another year", () => {
    expect(daysInMonth(0, 2001)).toBe(31);
    expect(daysInMonth(13, 2001)).toBe(31);
  });
});

describe("compareDate / sameDate", () => {
  it("orders by year, then month, then day", () => {
    expect(compareDate(d(1, 1, 1999), d(1, 1, 2000))).toBeLessThan(0);
    expect(compareDate(d(1, 5, 2000), d(1, 3, 2000))).toBeGreaterThan(0);
    expect(compareDate(d(9, 3, 2000), d(20, 3, 2000))).toBeLessThan(0);
    expect(compareDate(d(9, 3, 2000), d(9, 3, 2000))).toBe(0);
  });

  it("never lets a larger low-order field outrank a higher-order one", () => {
    // 31 Jan 2000 is earlier than 1 Feb 2000 despite the bigger day number.
    expect(compareDate(d(31, 1, 2000), d(1, 2, 2000))).toBeLessThan(0);
    expect(sameDate(d(31, 1, 2000), d(1, 2, 2000))).toBe(false);
    expect(sameDate(d(31, 1, 2000), d(31, 1, 2000))).toBe(true);
  });
});

describe("toDate / fromDate", () => {
  it("round-trips through a local Date", () => {
    const value = d(9, 7, 1998);
    expect(fromDate(toDate(value))).toEqual(value);
  });

  it("builds a local midnight, not a UTC one", () => {
    const date = toDate(d(1, 3, 1995));
    expect(date.getFullYear()).toBe(1995);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(1);
    expect(date.getHours()).toBe(0);
  });
});

describe("range", () => {
  it("is inclusive at both ends", () => {
    expect(range(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(range(7, 7)).toEqual([7]);
  });

  it("is empty when inverted", () => {
    expect(range(5, 1)).toEqual([]);
  });
});

describe("monthBounds", () => {
  const min = d(10, 5, 1990);
  const max = d(3, 8, 2026);

  it("constrains only the boundary years", () => {
    expect(monthBounds(1990, min, max)).toEqual([5, 12]);
    expect(monthBounds(2026, min, max)).toEqual([1, 8]);
    expect(monthBounds(2005, min, max)).toEqual([1, 12]);
  });

  it("constrains both ends when min and max share a year", () => {
    const lo = d(4, 3, 2020);
    const hi = d(9, 9, 2020);
    expect(monthBounds(2020, lo, hi)).toEqual([3, 9]);
  });
});

describe("dayBounds", () => {
  const min = d(10, 5, 1990);
  const max = d(3, 8, 2026);

  it("uses the calendar length for unconstrained months", () => {
    expect(dayBounds(2000, 1, min, max)).toEqual([1, 31]);
    expect(dayBounds(2000, 4, min, max)).toEqual([1, 30]);
    expect(dayBounds(2000, 2, min, max)).toEqual([1, 29]);
    expect(dayBounds(2001, 2, min, max)).toEqual([1, 28]);
  });

  it("clamps the low end only in the min month of the min year", () => {
    expect(dayBounds(1990, 5, min, max)).toEqual([10, 31]);
    expect(dayBounds(1990, 6, min, max)).toEqual([1, 30]);
    expect(dayBounds(1991, 5, min, max)).toEqual([1, 31]);
  });

  it("clamps the high end only in the max month of the max year", () => {
    expect(dayBounds(2026, 8, min, max)).toEqual([1, 3]);
    expect(dayBounds(2026, 7, min, max)).toEqual([1, 31]);
    expect(dayBounds(2025, 8, min, max)).toEqual([1, 31]);
  });
});

describe("normalizeDate", () => {
  const min = d(1, 1, 1925);
  const max = d(3, 8, 2026);

  it("leaves an in-range date untouched", () => {
    expect(normalizeDate(d(9, 7, 1998), min, max)).toEqual(d(9, 7, 1998));
  });

  it("shortens the day when the month cannot hold it", () => {
    expect(normalizeDate(d(31, 2, 2001), min, max)).toEqual(d(28, 2, 2001));
    expect(normalizeDate(d(31, 2, 2024), min, max)).toEqual(d(29, 2, 2024));
    expect(normalizeDate(d(31, 4, 2001), min, max)).toEqual(d(30, 4, 2001));
  });

  it("drops 29 February to the 28th in a non-leap year", () => {
    expect(normalizeDate(d(29, 2, 2023), min, max)).toEqual(d(28, 2, 2023));
  });

  it("pulls a date past the upper bound back, field by field", () => {
    // Scrolling the year wheel to 2026 must trim December to August, then
    // August to the 3rd — not rewrite the whole date.
    expect(normalizeDate(d(31, 12, 2026), min, max)).toEqual(d(3, 8, 2026));
    expect(normalizeDate(d(20, 8, 2026), min, max)).toEqual(d(3, 8, 2026));
    expect(normalizeDate(d(20, 7, 2026), min, max)).toEqual(d(20, 7, 2026));
    expect(normalizeDate(d(1, 1, 2030), min, max)).toEqual(d(1, 1, 2026));
  });

  it("pushes a date before the lower bound forward", () => {
    const lo = d(10, 5, 1990);
    expect(normalizeDate(d(1, 1, 1980), lo, max)).toEqual(d(10, 5, 1990));
    expect(normalizeDate(d(20, 3, 1990), lo, max)).toEqual(d(20, 5, 1990));
    expect(normalizeDate(d(3, 5, 1990), lo, max)).toEqual(d(10, 5, 1990));
    expect(normalizeDate(d(3, 6, 1990), lo, max)).toEqual(d(3, 6, 1990));
  });

  it("always lands inside the window", () => {
    const lo = d(10, 5, 1990);
    const hi = d(3, 8, 2026);
    const probes = [
      d(1, 1, 1900),
      d(31, 12, 2099),
      d(29, 2, 1900),
      d(31, 2, 1990),
      d(31, 12, 2026),
    ];
    for (const probe of probes) {
      const result = normalizeDate(probe, lo, hi);
      expect(compareDate(result, lo)).toBeGreaterThanOrEqual(0);
      expect(compareDate(result, hi)).toBeLessThanOrEqual(0);
      expect(result.day).toBeLessThanOrEqual(
        daysInMonth(result.month, result.year),
      );
    }
  });

  it("is idempotent", () => {
    const once = normalizeDate(d(31, 12, 2030), min, max);
    expect(normalizeDate(once, min, max)).toEqual(once);
  });
});

describe("resolveBounds", () => {
  const today = d(3, 8, 2026);

  it("stops at today when no upper bound is given", () => {
    const { min, max } = resolveBounds({ today });
    expect(min).toEqual(d(1, 1, 1925));
    expect(max).toEqual(today);
  });

  it("widens a bare maxYear to the end of that year", () => {
    const { max } = resolveBounds({ maxYear: 2010, today });
    expect(max).toEqual(d(31, 12, 2010));
  });

  it("widens a bare minYear to the start of that year", () => {
    const { min } = resolveBounds({ minYear: 1990, today });
    expect(min).toEqual(d(1, 1, 1990));
  });

  it("lets explicit dates win over the year props", () => {
    const { min, max } = resolveBounds({
      minYear: 1990,
      maxYear: 2010,
      minDate: d(10, 5, 1995),
      maxDate: d(2, 2, 2005),
      today,
    });
    expect(min).toEqual(d(10, 5, 1995));
    expect(max).toEqual(d(2, 2, 2005));
  });

  it("swaps an inverted window rather than producing empty wheels", () => {
    const { min, max } = resolveBounds({
      minDate: d(1, 1, 2020),
      maxDate: d(1, 1, 2000),
      today,
    });
    expect(min).toEqual(d(1, 1, 2000));
    expect(max).toEqual(d(1, 1, 2020));
  });

  it("keeps 29 February reachable when the max year is a leap year", () => {
    const { max } = resolveBounds({ maxYear: 2024, today });
    const [, hi] = dayBounds(2024, 2, d(1, 1, 1925), max);
    expect(hi).toBe(29);
  });
});
