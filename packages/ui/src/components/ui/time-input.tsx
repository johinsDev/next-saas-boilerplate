"use client";

import { ClockIcon } from "lucide-react";

import { cn } from "../../cn";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group";

type TimeInputProps = {
  /** Time in 24-hour `"HH:mm"` format. */
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
};

/**
 * Native time field with a leading clock glyph, built on {@link InputGroup}.
 * Emits the raw `"HH:mm"` string the browser produces.
 */
export function TimeInput({
  value,
  onChange,
  disabled,
  className,
  id,
}: TimeInputProps) {
  return (
    <InputGroup className={cn("h-10 rounded-xl", className)}>
      <InputGroupAddon align="inline-start">
        <ClockIcon className="text-muted-foreground size-4" />
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="time"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </InputGroup>
  );
}
