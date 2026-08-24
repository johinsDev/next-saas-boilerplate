"use client";

import { CalendarIcon } from "lucide-react";
import * as React from "react";
import type { DateRange, Matcher, Modifiers } from "react-day-picker";

import { cn } from "../../cn";
import { useIsMobile } from "../../hooks/use-mobile";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "./responsive-modal";

export interface DateRangeValue {
  from?: Date;
  to?: Date;
}

export interface DateRangePickerProps {
  /** Selected range (uncontrolled-friendly: pass `undefined`/empty for empty). */
  value?: DateRangeValue;
  onValueChange?: (range: DateRangeValue) => void;
  placeholder?: string;
  /** Localized "Clear" label; shows a footer button to clear the range. */
  clearLabel?: string;
  /** Localized "Apply" label (mobile commits the draft range to the URL). */
  applyLabel?: string;
  /** Localized label for a single endpoint (e.g. `@saas/date` formatDate). */
  formatLabel?: (date: Date) => string;
  /** Months always shown (default 2). Desktop side-by-side, mobile stacked. */
  numberOfMonths?: number;
  /** Block future dates — history can never be in the future. */
  disableFuture?: boolean;
  className?: string;
  disabled?: boolean;
}

/** Bigger, airier calendar sizing scoped to the range picker (Airbnb-style):
 *  larger day cells + rounded endpoints + roomier caption/weekday rows. Applied
 *  via `className` so single-mode `DatePicker` keeps its compact default. */
const RANGE_CALENDAR_CLASSNAME =
  "[--cell-radius:calc(var(--cell-size)/2)] [--cell-size:--spacing(11)] md:[--cell-size:--spacing(9)] p-3 sm:p-4";

const RANGE_CLASSNAMES = {
  months: "relative flex flex-col gap-5 md:flex-row md:gap-6",
  month_caption:
    "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size) text-base font-semibold",
  weekday:
    "flex-1 rounded-(--cell-radius) text-xs font-bold tracking-wide text-foreground uppercase select-none",
};

/** Whole-day equality (local parts), so hover preview compares calendar days. */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Airbnb-style date *range* picker — one `Calendar` in `mode="range"`. One click
 * sets the start, the next sets the end; react-day-picker auto-orders the two
 * clicks, so an invalid (end < start) range is impossible. While picking the end
 * day, hovering paints a continuous soft-gray band from the start up to the
 * hovered day (custom `preview_*` modifiers, styled in `calendar.tsx` with the
 * same gray as `range_middle`). Always shows 2 months: side-by-side on desktop
 * (Popover), stacked vertically inside a Drawer on mobile so they have room.
 * i18n-agnostic: pass `formatLabel`.
 */
export function DateRangePicker({
  value,
  onValueChange,
  placeholder = "Rango de fechas",
  clearLabel,
  applyLabel = "Aplicar",
  formatLabel,
  numberOfMonths = 2,
  disableFuture,
  className,
  disabled,
}: DateRangePickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState<Date | undefined>(undefined);
  // On mobile the selection is a DRAFT until "Aplicar" commits it to the URL;
  // closing the Drawer discards it. Desktop applies immediately on select.
  const [draft, setDraft] = React.useState<DateRangeValue>(value ?? {});
  const activeRange = isMobile ? draft : value;
  const handleSelect = (range?: DateRange) => {
    const next = { from: range?.from, to: range?.to };
    if (isMobile) setDraft(next);
    else onValueChange?.(next);
  };

  const label = (date: Date) => formatLabel?.(date) ?? date.toLocaleDateString();

  const hasValue = Boolean(value?.from);
  const triggerLabel = value?.from
    ? value.to
      ? `${label(value.from)} – ${label(value.to)}`
      : label(value.from)
    : placeholder;

  // Preview band: only while a start is chosen and the end is still pending.
  const previewing = Boolean(activeRange?.from && !activeRange?.to);
  const previewModifiers = React.useMemo<
    Partial<Record<string, Matcher | Matcher[]>>
  >(() => {
    if (!previewing || !activeRange?.from || !hovered) return {};
    const from = startOfDay(activeRange.from);
    const end = startOfDay(hovered);
    if (end <= from) return {};
    return {
      preview_end: (day: Date) => isSameDay(day, end),
      preview_middle: (day: Date) => {
        const d = startOfDay(day);
        return d > from && d < end;
      },
    };
  }, [previewing, activeRange?.from, hovered]);

  // History orientation: when future is blocked, open on PREVIOUS + CURRENT
  // month (so both pages have selectable past days) and cap "next" at the
  // current month so the user can't page into an all-disabled future page.
  const { defaultMonth, endMonth } = React.useMemo(() => {
    if (!disableFuture) return { defaultMonth: undefined, endMonth: undefined };
    const now = new Date();
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { defaultMonth: previous, endMonth: current };
  }, [disableFuture]);

  const clear = () => {
    onValueChange?.({});
    setHovered(undefined);
  };

  const calendar = (
    <Calendar
      mode="range"
      numberOfMonths={numberOfMonths}
      selected={activeRange as DateRange | undefined}
      onSelect={handleSelect}
      disabled={disableFuture ? ({ after: new Date() } as Matcher) : undefined}
      defaultMonth={defaultMonth}
      endMonth={endMonth}
      modifiers={previewModifiers}
      onDayMouseEnter={(day: Date, _m: Modifiers) => setHovered(day)}
      onDayMouseLeave={() => setHovered(undefined)}
      className={RANGE_CALENDAR_CLASSNAME}
      classNames={RANGE_CLASSNAMES}
      autoFocus
    />
  );

  const clearFooter =
    clearLabel && hasValue ? (
      <div className="flex justify-end border-t px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={clear}
          className="text-muted-foreground hover:text-foreground font-medium underline-offset-4 hover:underline"
        >
          {clearLabel}
        </Button>
      </div>
    ) : null;

  const trigger = (
    <Button
      variant="outline"
      disabled={disabled}
      className={cn(
        "h-10 w-full justify-start gap-2 rounded-xl font-normal",
        !hasValue && "text-muted-foreground",
        className,
      )}
    >
      <CalendarIcon className="size-4 shrink-0" />
      <span className="truncate">{triggerLabel}</span>
    </Button>
  );

  if (isMobile) {
    return (
      <>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={cn(
            "h-10 w-full justify-start gap-2 rounded-xl font-normal",
            !hasValue && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="truncate">{triggerLabel}</span>
        </Button>
        <ResponsiveModal
          open={open}
          onOpenChange={(next) => {
            // Re-seed the draft from the committed value each time it opens, so a
            // discarded (closed-without-Aplicar) edit never leaks into the next.
            if (next) setDraft(value ?? {});
            setOpen(next);
          }}
        >
          <ResponsiveModalContent mobileClassName="pb-0">
            <ResponsiveModalTitle className="sr-only">
              {placeholder}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="sr-only">
              {triggerLabel}
            </ResponsiveModalDescription>
            {/* Inner scroll region with an explicit max-height (not flex-based)
                so the stacked months scroll reliably inside the Drawer.
                `data-vaul-no-drag` stops vaul's drag handler from swallowing day
                taps (otherwise clicking a day never registers as a select). */}
            <div
              data-vaul-no-drag
              className="max-h-[70dvh] overflow-y-auto overscroll-contain"
            >
              <div className="flex justify-center px-2 pt-2">{calendar}</div>
            </div>
            {/* Pinned draft footer: Aplicar commits the draft to the URL; Limpiar
                resets it; closing without Aplicar discards it. */}
            <div className="flex items-center justify-between gap-3 border-t px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setDraft({})}
                disabled={!draft.from}
                className="text-muted-foreground hover:text-foreground h-12 px-5 text-base font-semibold"
              >
                {clearLabel}
              </Button>
              <Button
                size="lg"
                onClick={() => {
                  onValueChange?.(draft);
                  setOpen(false);
                }}
                className="h-12 rounded-xl px-10 text-base font-semibold"
              >
                {applyLabel}
              </Button>
            </div>
          </ResponsiveModalContent>
        </ResponsiveModal>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" className="w-auto p-0">
        {calendar}
        {clearFooter}
      </PopoverContent>
    </Popover>
  );
}
