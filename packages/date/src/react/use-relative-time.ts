"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import { formatRelative } from "../format";
import { parseDate } from "../parse";

type Input = Date | string | number | null | undefined;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Pick the next tick interval (ms) given how old `date` is right now. */
function nextTickMs(ageMs: number): number | null {
  const abs = Math.abs(ageMs);
  if (abs < MIN) return 1_000;
  if (abs < HOUR) return MIN;
  if (abs < DAY) return HOUR;
  return null;
}

/**
 * Live-updating "hace 3 minutos" / "in 3 minutes" string.
 *
 * - Cadence adapts to how old the date is (per-second under 1 min, per-minute
 *   under 1 hour, hourly under 1 day, then stops — older deltas don't move
 *   visibly).
 * - Pauses when the tab is backgrounded; resumes on visibility change.
 * - Locale comes from next-intl's `useLocale()`, so the same date renders
 *   "hace 3 minutos" for `es` users and "3 minutes ago" for `en` users.
 *
 * Render this only inside a client component. For SSR-safe output (no hydration
 * mismatch), use `<RelativeTime />` instead.
 */
export function useRelativeTime(input: Input): string {
  const locale = useLocale();
  const [, force] = useState(0);

  const date = parseDate(input);

  useEffect(() => {
    if (!date) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (document.visibilityState === "hidden") return;
      const delta = Date.now() - date.getTime();
      const next = nextTickMs(delta);
      if (next === null) return;
      timer = setTimeout(() => {
        force((n) => n + 1);
        schedule();
      }, next);
    };

    const onVisibility = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (document.visibilityState === "visible") {
        force((n) => n + 1);
        schedule();
      }
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [date]);

  if (!date) return "";
  return formatRelative(date, { locale });
}
