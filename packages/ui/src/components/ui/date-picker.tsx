"use client";

import { CalendarIcon } from "lucide-react";

import { cn } from "../../cn";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface DatePickerProps {
  /** Selected date (uncontrolled-friendly: pass `undefined` for empty). */
  value?: Date;
  onValueChange?: (date: Date | undefined) => void;
  placeholder?: string;
  /** Localized label for the selected date (e.g. `@saas/date` formatDate). */
  formatLabel?: (date: Date) => string;
  className?: string;
  disabled?: boolean;
}

/**
 * Date picker — the shadcn pattern: a Button trigger showing the selected date
 * (or placeholder) that opens a `Calendar` in a `Popover`. Use this for any
 * calendar-style date field (scheduling, dates); `DateWheelPicker` stays for
 * birthdays / date-of-birth. i18n-agnostic: pass `formatLabel` for the label.
 */
export function DatePicker({
  value,
  onValueChange,
  placeholder = "Elegí una fecha",
  formatLabel,
  className,
  disabled,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-start gap-2 rounded-xl font-normal",
              !value && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="size-4" />
            {value
              ? (formatLabel?.(value) ?? value.toLocaleDateString())
              : placeholder}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onValueChange}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
