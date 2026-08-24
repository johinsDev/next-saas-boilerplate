"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "../../cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/**
 * Compact segmented control (iOS-style): a pill track with the active option
 * raised on a `card` chip. Generic over the option value so callers stay
 * type-safe (`SegmentedControl<"es" | "en">`). Controlled — pass `value` and
 * handle `onValueChange`. Stays i18n-agnostic; labels come from the caller.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  className,
  "aria-label": ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "bg-muted inline-flex items-center gap-1 rounded-full p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full py-1.5 text-sm font-semibold transition-colors",
              // Icon-only chips get square padding; labelled chips stay wide.
              option.label ? "px-4" : "px-2.5",
              active
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="size-4" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
