"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "./cn";
import {
  useThemeTransition,
  type RectStart,
  type ThemeVariant,
} from "./components/motion/theme-toggle";

/**
 * Light, dark, or whatever the system says — as one segmented control.
 *
 * beUI's `ThemeToggle` flips between two, which is the right control for a
 * sidebar rail and the wrong one for a menu: it cannot express "follow the
 * system", so somebody who has never touched it is shown a state they did not
 * choose and cannot get back to.
 *
 * The reveal is the same one `ThemeToggle` does — `useThemeTransition` is that
 * machinery split out of it, because upstream welds it to a two-state flip and
 * a third position could not reach it. Same CSS, same durations, skipped
 * entirely when the browser has no View Transition support or the viewer asked
 * for less motion.
 */

const CHOICES = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;

export function ThemeChoice({
  className,
  /*
   * A circle growing from the control, rather than the rail's upward wipe.
   * Defaults suit a menu anchored at the foot of a sidebar, which is where
   * this lives; a control somewhere else should say so.
   */
  variant = "circle-blur",
  start = "bottom-left",
}: {
  className?: string;
  variant?: ThemeVariant;
  start?: RectStart;
}) {
  const { theme } = useTheme();
  const applyTheme = useThemeTransition({ variant, start });

  /*
   * `theme` is read from storage on the client, so it is `undefined` on the
   * server and for the first paint. Rendering nothing as selected until then
   * is deliberate: guessing "system" would light the wrong segment for anybody
   * who chose otherwise, and then move it under their cursor.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "flex items-center gap-0.5 rounded-full border border-border p-0.5",
        className,
      )}
    >
      {CHOICES.map(({ value, label, Icon }) => {
        const selected = mounted && theme === value;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => applyTheme(value)}
            title={label}
            className={cn(
              "flex size-6 items-center justify-center rounded-full transition-colors",
              selected
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-3.5" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
