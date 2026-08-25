"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { motion, useReducedMotion } from "motion/react";
import { useId, type ReactNode } from "react";

import { cn } from "./cn";

/**
 * A radio group whose options are cards rather than dots.
 *
 * Worth the extra weight when the choice *is* the explanation — picking a role
 * is choosing what somebody will be able to do, and a row of pills makes you
 * already know the answer. Each option carries a description, so the form
 * stops needing a paragraph underneath it telling you what you just picked.
 *
 * It is not the control for a dense form: three cards take the room of one
 * select. Use `Select` when the label is enough on its own.
 *
 * Built on Base UI's `RadioGroup`, so arrow keys move between options, the
 * group takes one tab stop, and the label is wired for screen readers — none
 * of which a div-with-onClick gets for free. The selection ring animates with
 * a shared `layoutId`, which is the whole reason for `motion` here: it travels
 * between cards rather than blinking out and in.
 */

export type ChoiceboxOption<T extends string> = {
  readonly value: T;
  readonly label: string;
  readonly description?: string;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
  /** Shown right-aligned — a count, a price, "current". */
  readonly meta?: ReactNode;
};

export function Choicebox<T extends string>({
  value,
  onValueChange,
  options,
  name,
  className,
  columns = 1,
}: {
  value: T | null;
  onValueChange: (value: T) => void;
  options: readonly ChoiceboxOption<T>[];
  name?: string;
  className?: string;
  /** 1 stacks them; 2–3 puts them side by side where the copy is short. */
  columns?: 1 | 2 | 3;
}) {
  const reduce = useReducedMotion() ?? false;
  /*
   * One layoutId per mounted group. Two Choiceboxes on a page sharing a
   * literal string would animate the ring *between them* — it would fly across
   * the form when you picked an option in the other one.
   */
  const ring = `choicebox-${useId()}`;

  return (
    <RadioGroup
      name={name}
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      className={cn(
        "grid gap-2",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-3",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Radio.Root
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(
              "group relative flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
              "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              selected ? "border-primary bg-primary/[0.06]" : "border-border hover:border-foreground/25",
              option.disabled && "pointer-events-none opacity-55",
            )}
          >
            {/*
             * The ring is a sibling that travels, not a border that toggles.
             * Under `motion-reduce` it is dropped entirely rather than
             * animated at zero duration — a layout animation that "runs" in
             * 0ms still forces a reflow on every option.
             */}
            {selected && !reduce && (
              <motion.span
                layoutId={ring}
                aria-hidden
                transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
                className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary"
              />
            )}

            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                selected ? "border-primary" : "border-border",
              )}
            >
              <Radio.Indicator className="size-2 rounded-full bg-primary" />
            </span>

            <span className="relative z-10 flex min-w-0 grow flex-col gap-0.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {option.icon}
                {option.label}
              </span>
              {option.description && (
                <span className="text-[11.5px] leading-relaxed text-muted-foreground">
                  {option.description}
                </span>
              )}
            </span>

            {option.meta && (
              <span className="relative z-10 shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {option.meta}
              </span>
            )}
          </Radio.Root>
        );
      })}
    </RadioGroup>
  );
}
