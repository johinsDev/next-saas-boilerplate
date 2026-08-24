import { enUS as enBase } from "date-fns/locale/en-US";
import { es as esBase } from "date-fns/locale/es";
import type { Locale } from "date-fns/locale";

/**
 * Spanish (Colombia) locale.
 *
 * date-fns ships a single `es` locale that's Spain-flavored (24h time).
 * Colombia conventionally uses 12h with `p. m.` / `a. m.` in consumer contexts
 * (POS receipts, product UI). This extension overrides only the formats that
 * differ from Castilian — date order, words, and month names stay identical.
 */
export const esCO: Locale = {
  ...esBase,
  code: "es-CO",
  formatLong: esBase.formatLong
    ? {
        ...esBase.formatLong,
        time: () => "h:mm a",
        dateTime: () => "{{date}} 'a las' {{time}}",
      }
    : esBase.formatLong,
};

export const enUS: Locale = enBase;

/**
 * Resolve a locale code (as exposed by next-intl's `useLocale()` /
 * `getLocale()`) to a date-fns Locale object. Falls back to esCO so a
 * formatter never throws on an unknown locale — it just speaks Spanish.
 */
export function localeFromCode(code: string | null | undefined): Locale {
  if (!code) return esCO;
  const lower = code.toLowerCase();
  if (lower === "es" || lower.startsWith("es-")) return esCO;
  if (lower === "en" || lower.startsWith("en-")) return enUS;
  return esCO;
}
