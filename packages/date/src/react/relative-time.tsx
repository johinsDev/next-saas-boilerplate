"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import { formatDateTime } from "../format";
import { parseDate } from "../parse";
import { useRelativeTime } from "./use-relative-time";

type Input = Date | string | number | null | undefined;

type Props = {
  date: Input;
  /** Force absolute rendering even after hydration. Useful for tooltips. */
  absolute?: boolean;
  className?: string;
};

/**
 * SSR-safe live-updating timestamp.
 *
 * - **Server + first paint:** renders the absolute datetime (`formatDateTime`).
 *   Deterministic — no `Date.now()` involvement, so SSR HTML matches the first
 *   client render exactly. No hydration mismatch.
 * - **After hydration:** swaps to the live "hace N minutos" string and updates
 *   on the cadence picked by `useRelativeTime`.
 * - Always emits a `<time dateTime="...">` element so machines, screen readers,
 *   and tooltips see the canonical ISO timestamp.
 */
export function RelativeTime({ date, absolute, className }: Props) {
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const relative = useRelativeTime(date);

  const parsed = parseDate(date);
  if (!parsed) return null;

  const iso = parsed.toISOString();
  const abs = formatDateTime(parsed, { locale });
  const shown = absolute || !mounted ? abs : relative;

  return (
    <time dateTime={iso} title={abs} className={className} suppressHydrationWarning>
      {shown}
    </time>
  );
}
