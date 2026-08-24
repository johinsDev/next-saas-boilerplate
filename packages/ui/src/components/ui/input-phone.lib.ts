import {
  AsYouType,
  type CountryCode as LibCountryCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

import { COUNTRIES, type CountryCode } from "./input-phone.countries";

/**
 * Rich value emitted by `InputPhone.onChange`. The consumer picks what it
 * needs — auth uses `e164`; a display surface might use `formatted`.
 */
export interface PhoneValue {
  /** E.164, ready for Better Auth (`+573122186181`). `""` when empty. */
  e164: string;
  /** National formatting only (`(312) 218 6181`). */
  national: string;
  /** Dial code + national (`+57 (312) 218 6181`). */
  formatted: string;
  countryCode: CountryCode;
  /** Calling code without `+` (`57`). */
  dialCode: string;
  /** Bare national digits (`3122186181`). */
  nationalNumber: string;
  /** Passes libphonenumber's full validation for the country. */
  isValid: boolean;
  /** Could be a valid number (right length) but not fully validated. */
  isPossible: boolean;
}

/** Strip everything that isn't a digit. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

/** Max national digits a country accepts — drives the input `maxLength`. */
export function maxNationalLength(country: CountryCode): number {
  return COUNTRIES[country].nationalDigits;
}

/**
 * Apply a fixed mask template: `#` consumes a digit, any other char is a
 * literal. Stops as soon as the digits run out (no dangling literals).
 */
export function applyMask(digits: string, mask: string): string {
  let out = "";
  let i = 0;
  for (const ch of mask) {
    if (i >= digits.length) break;
    if (ch === "#") {
      out += digits[i];
      i += 1;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Live national formatting for the input. Uses the country's `mask` override
 * when set, otherwise libphonenumber's `AsYouType` (which yields the canonical
 * national format, e.g. `(312) 128 6181`, `(80) 123 1234`).
 */
export function formatNational(digits: string, country: CountryCode): string {
  const trimmed = digits.slice(0, maxNationalLength(country));
  const mask = COUNTRIES[country].mask;
  if (mask) return applyMask(trimmed, mask);
  return new AsYouType(country as LibCountryCode).input(trimmed);
}

/** Build the full `PhoneValue` from national digits + selected country. */
export function toPhoneValue(
  digits: string,
  country: CountryCode,
): PhoneValue {
  const def = COUNTRIES[country];
  const trimmed = digitsOnly(digits).slice(0, maxNationalLength(country));
  const national = formatNational(trimmed, country);

  const base: PhoneValue = {
    e164: trimmed ? `+${def.dialCode}${trimmed}` : "",
    national,
    formatted: trimmed ? `+${def.dialCode} ${national}` : "",
    countryCode: country,
    dialCode: def.dialCode,
    nationalNumber: trimmed,
    isValid: false,
    isPossible: false,
  };

  if (!trimmed) return base;

  const parsed = parsePhoneNumberFromString(base.e164);
  if (!parsed) return base;
  return {
    ...base,
    e164: parsed.number,
    national: COUNTRIES[country].mask ? national : parsed.formatNational(),
    formatted: `+${def.dialCode} ${
      COUNTRIES[country].mask ? national : parsed.formatNational()
    }`,
    nationalNumber: parsed.nationalNumber,
    isValid: parsed.isValid(),
    isPossible: parsed.isPossible(),
  };
}

/**
 * Derive the country + national digits from an E.164 string, so a controlled
 * `value` can hydrate the input. Returns `null` if it can't be parsed to a
 * supported country.
 */
export function parseE164(
  value: string,
): { country: CountryCode; nationalNumber: string } | null {
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed?.country) return null;
  if (!(parsed.country in COUNTRIES)) return null;
  return {
    country: parsed.country as CountryCode,
    nationalNumber: parsed.nationalNumber,
  };
}

/** Reusable validity check for consumers' Zod schemas (`z.string().refine(...)`). */
export function isValidE164Phone(value: string): boolean {
  return isValidPhoneNumber(value);
}
