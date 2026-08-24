"use client";

import { Minus, Plus } from "lucide-react";

import { cn } from "../../cn";
import { Button } from "./button";
import { NumberInput } from "./number-input";

type NumberStepperProps = {
  /** Numeric value (not the formatted string). */
  value?: number;
  /** Fires with the parsed number (or `undefined` when cleared). */
  onValueChange?: (value: number | undefined) => void;
  /** Amount added/subtracted per minus/plus press. */
  step?: number;
  min?: number;
  max?: number;
  className?: string;
};

/**
 * Number field flanked by minus/plus buttons inside one bordered group —
 * `[−] [ value ] [+]`. Composes {@link NumberInput} between two {@link Button}s
 * (no extra deps). Stepping treats a missing value as `0`, then clamps to
 * `min`/`max` and emits via `onValueChange`.
 */
export function NumberStepper({
  value,
  onValueChange,
  step = 1,
  min,
  max,
  className,
}: NumberStepperProps) {
  const current = value ?? 0;

  const clamp = (next: number) => {
    let result = next;
    if (min !== undefined) {
      result = Math.max(min, result);
    }
    if (max !== undefined) {
      result = Math.min(max, result);
    }
    return result;
  };

  const atMin = min !== undefined && current <= min;
  const atMax = max !== undefined && current >= max;

  return (
    <div
      className={cn(
        "border-input inline-flex items-center overflow-hidden rounded-xl border",
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Decrease"
        disabled={atMin}
        className="rounded-none"
        onClick={() => onValueChange?.(clamp(current - step))}
      >
        <Minus />
      </Button>
      <NumberInput
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        className="h-10 rounded-none border-0 text-center focus-visible:ring-0"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Increase"
        disabled={atMax}
        className="rounded-none"
        onClick={() => onValueChange?.(clamp(current + step))}
      >
        <Plus />
      </Button>
    </div>
  );
}
