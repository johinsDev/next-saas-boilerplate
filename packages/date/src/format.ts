import { format as fmt } from "date-fns/format";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { isSameYear } from "date-fns/isSameYear";

import { localeFromCode } from "./locales";
import { isValidDate, parseDate } from "./parse";

type Input = Date | string | number | null | undefined;

type LocaleOption = { locale?: string };

type DatePreset = "short" | "medium" | "long" | "iso";

type DateTimePreset = "short" | "medium" | "long";

const DATE_PATTERNS: Record<DatePreset, string> = {
  short: "P",          // 11/05/2026 (es) / 05/11/2026 (en)
  medium: "PP",         // 11 may 2026 / May 11, 2026
  long: "PPP",          // 11 de mayo de 2026 / May 11th, 2026
  iso: "yyyy-MM-dd",
};

const DATETIME_PATTERNS: Record<DateTimePreset, string> = {
  short: "Pp",
  medium: "PPp",
  long: "PPPp",
};

function toDateOrNull(input: Input): Date | null {
  if (input instanceof Date) return isValidDate(input) ? input : null;
  return parseDate(input);
}

/** Format a date as a calendar date. Returns "" for invalid input. */
export function formatDate(input: Input, options: LocaleOption & { preset?: DatePreset } = {}): string {
  const date = toDateOrNull(input);
  if (!date) return "";
  return fmt(date, DATE_PATTERNS[options.preset ?? "medium"], {
    locale: localeFromCode(options.locale),
  });
}

/** "2 de marzo" / "March 2" — day and month, no year. */
const BIRTHDAY_PATTERNS: Record<BirthdayPreset, string> = {
  dayMonth: "d MMMM",
  dayMonthShort: "d MMM",
  full: "PP",
};

type BirthdayPreset = "dayMonth" | "dayMonthShort" | "full";

/**
 * Format a date of birth. Birthdays are stored as **UTC midnight** of the day
 * the customer picked, so formatting them in local time renders the day before
 * for anyone behind UTC — in Bogotá (UTC-5) a 2 March birthday reads "1 de
 * marzo". This re-anchors the instant so the local wall clock lands on the
 * stored calendar day, then formats normally.
 *
 * Use this for every birthday surface; `formatDate` is for real timestamps.
 */
export function formatBirthday(
  input: Input,
  options: LocaleOption & { preset?: BirthdayPreset } = {},
): string {
  const date = toDateOrNull(input);
  if (!date) return "";
  const asLocalDay = new Date(
    date.getTime() + date.getTimezoneOffset() * 60_000,
  );
  return fmt(asLocalDay, BIRTHDAY_PATTERNS[options.preset ?? "dayMonth"], {
    locale: localeFromCode(options.locale),
  });
}

/** Format the time portion only (HH:mm or h:mm a depending on locale). */
export function formatTime(input: Input, options: LocaleOption & { seconds?: boolean } = {}): string {
  const date = toDateOrNull(input);
  if (!date) return "";
  const pattern = options.seconds ? "pp" : "p";
  return fmt(date, pattern, { locale: localeFromCode(options.locale) });
}

/** Format date + time with locale-aware joiner. */
export function formatDateTime(input: Input, options: LocaleOption & { preset?: DateTimePreset } = {}): string {
  const date = toDateOrNull(input);
  if (!date) return "";
  return fmt(date, DATETIME_PATTERNS[options.preset ?? "medium"], {
    locale: localeFromCode(options.locale),
  });
}

/** "hace 3 minutos" / "in 3 minutes". Always relative to `now` (default: real clock). */
export function formatRelative(input: Input, options: LocaleOption & { now?: Date } = {}): string {
  const date = toDateOrNull(input);
  if (!date) return "";
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: localeFromCode(options.locale),
    ...(options.now ? { now: options.now } : {}),
  });
}

/**
 * Format a date range. Collapses same-month/same-year repetition:
 *   "11 – 13 may 2026" (same month)
 *   "11 may – 5 jun 2026" (same year, different month)
 *   "29 dic 2025 – 2 ene 2026" (different year)
 */
export function formatDateRange(
  start: Input,
  end: Input,
  options: LocaleOption = {},
): string {
  const s = toDateOrNull(start);
  const e = toDateOrNull(end);
  if (!s || !e) return "";
  const locale = localeFromCode(options.locale);
  if (s.getTime() === e.getTime()) return fmt(s, "PP", { locale });
  if (isSameYear(s, e)) {
    if (s.getMonth() === e.getMonth()) {
      return `${fmt(s, "d", { locale })} – ${fmt(e, "d MMM yyyy", { locale })}`;
    }
    return `${fmt(s, "d MMM", { locale })} – ${fmt(e, "d MMM yyyy", { locale })}`;
  }
  return `${fmt(s, "PP", { locale })} – ${fmt(e, "PP", { locale })}`;
}
