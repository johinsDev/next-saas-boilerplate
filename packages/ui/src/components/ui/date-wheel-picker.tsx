"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../../cn";
import {
  DEFAULT_FIELD_ORDER,
  type DateField,
  type DateValue,
  dayBounds,
  fromDate,
  monthBounds,
  normalizeDate,
  range,
  resolveBounds,
  sameDate,
} from "./date-wheel-picker.lib";
import { WheelPicker, type WheelPickerOption } from "./wheel-picker";

export type DateWheelPickerProps = {
  /** Selected date. `month` is 1-12. */
  value: DateValue;
  onValueChange: (value: DateValue) => void;
  /** 12 localized month names (index 0 = January). */
  monthLabels: string[];
  /** Lower bound as a whole year. Ignored when `minDate` is given. */
  minYear?: number;
  /**
   * Upper bound as a whole year. Ignored when `maxDate` is given. Leave both
   * unset and the wheels stop at today — a birth date is never in the future.
   */
  maxYear?: number;
  /** Exact lower bound. Wins over `minYear`. */
  minDate?: DateValue;
  /** Exact upper bound. Wins over `maxYear`. */
  maxDate?: DateValue;
  /** Column order, left to right. Default day → month → year. */
  order?: readonly DateField[];
  /** Column headings, already localized. Double as each wheel's accessible name. */
  dayLabel?: string;
  monthLabel?: string;
  yearLabel?: string;
  /** Rows visible through each wheel, odd. Default 5. */
  visibleCount?: number;
  /** Row height in px. Default 44 (touch target). */
  itemHeight?: number;
  disabled?: boolean;
  /** Tick on every row crossed. Default false. */
  sound?: boolean;
  className?: string;
};

/** Relative widths: the month names need the room, the day needs the least. */
const FIELD_FLEX: Record<DateField, number> = {
  day: 0.8,
  month: 1.4,
  year: 1.1,
};

/**
 * Date-of-birth picker: three iOS-style {@link WheelPicker} drums (day / month
 * / year) sharing one highlighted centre band. No calendar grid — scrolling
 * decades is the point, and a calendar's year navigation is the wrong tool for
 * it.
 *
 * Controlled and i18n-agnostic: pass `monthLabels` and the column headings
 * already localized.
 *
 * The wheels stay consistent with one another. February offers 28 or 29 days
 * depending on the year sitting on the year wheel, and the bounds are enforced
 * per column — under the default upper bound of today, scrolling the year wheel
 * to the current year trims the month wheel at the current month, and that
 * month at today's day.
 */
function DateWheelPicker({
  value,
  onValueChange,
  monthLabels,
  minYear,
  maxYear,
  minDate,
  maxDate,
  order = DEFAULT_FIELD_ORDER,
  dayLabel,
  monthLabel,
  yearLabel,
  visibleCount = 5,
  itemHeight = 44,
  disabled = false,
  sound = false,
  className,
}: DateWheelPickerProps) {
  // Read the clock once per mount: re-reading it mid-render would let the
  // bounds shift under the wheels.
  const [today] = useState(() => fromDate(new Date()));

  const { min, max } = useMemo(
    () => resolveBounds({ minYear, maxYear, minDate, maxDate, today }),
    [minYear, maxYear, minDate, maxDate, today],
  );

  // Render against a value guaranteed to exist on the wheels, and push the
  // correction back up so the parent's state stops disagreeing with what is on
  // screen (an out-of-range `value`, or 31 January carried into February).
  const safe = useMemo(() => normalizeDate(value, min, max), [value, min, max]);
  useEffect(() => {
    if (!sameDate(safe, value)) onValueChange(safe);
  }, [safe, value, onValueChange]);

  const yearOptions = useMemo<WheelPickerOption[]>(
    () => range(min.year, max.year).map(String),
    [min.year, max.year],
  );
  const monthOptions = useMemo<WheelPickerOption[]>(() => {
    const [lo, hi] = monthBounds(safe.year, min, max);
    return range(lo, hi).map((m) => ({
      value: String(m),
      label: monthLabels[m - 1] ?? String(m),
    }));
  }, [safe.year, min, max, monthLabels]);
  const dayOptions = useMemo<WheelPickerOption[]>(() => {
    const [lo, hi] = dayBounds(safe.year, safe.month, min, max);
    return range(lo, hi).map(String);
  }, [safe.year, safe.month, min, max]);

  // The value we last handed to `onValueChange`. Each wheel only knows its own
  // field, so it merges its change into the rest of the date — and two wheels
  // can settle before the parent re-renders (tap the year, then the month).
  // Merging into the render-time value there would silently drop the first
  // change; merging into this ref composes them.
  const pending = useRef(safe);
  if (!sameDate(pending.current, safe)) pending.current = safe;

  const update = (patch: Partial<DateValue>) => {
    const next = normalizeDate({ ...pending.current, ...patch }, min, max);
    pending.current = next;
    onValueChange(next);
  };

  // `bare` so the three drums read as one control under the shared band below.
  const shared = { visibleCount, itemHeight, disabled, sound } as const;

  const wheels: Record<DateField, ReactNode> = {
    day: (
      <WheelPicker
        {...shared}
        variant="bare"
        options={dayOptions}
        value={String(safe.day)}
        onValueChange={(v) => update({ day: Number(v) })}
        aria-label={dayLabel}
      />
    ),
    month: (
      <WheelPicker
        {...shared}
        variant="bare"
        options={monthOptions}
        value={String(safe.month)}
        onValueChange={(v) => update({ month: Number(v) })}
        aria-label={monthLabel}
      />
    ),
    year: (
      <WheelPicker
        {...shared}
        variant="bare"
        options={yearOptions}
        value={String(safe.year)}
        onValueChange={(v) => update({ year: Number(v) })}
        aria-label={yearLabel}
      />
    ),
  };

  const headings: Record<DateField, string | undefined> = {
    day: dayLabel,
    month: monthLabel,
    year: yearLabel,
  };
  const hasHeadings = order.some((field) => headings[field]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {hasHeadings ? (
        <div className="text-muted-foreground flex gap-2 px-1.5 text-xs font-bold tracking-wider">
          {order.map((field) => (
            <span
              key={field}
              className="text-center"
              style={{ flex: FIELD_FLEX[field] }}
            >
              {headings[field]}
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative flex gap-2">
        {/* One band spanning all three wheels. Painted first so the wheels —
            also positioned — stack above it. */}
        <div
          aria-hidden
          className="bg-primary/10 ring-primary/25 pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-xl ring-1"
          style={{ height: itemHeight }}
        />
        {order.map((field) => (
          <div key={field} className="relative" style={{ flex: FIELD_FLEX[field] }}>
            {wheels[field]}
          </div>
        ))}
      </div>
    </div>
  );
}

export { DateWheelPicker };
