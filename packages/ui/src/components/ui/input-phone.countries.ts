import {
  type CountryCode as LibCountryCode,
  getCountryCallingCode,
} from "libphonenumber-js";
import type * as React from "react";

import {
  CaFlag,
  CoFlag,
  CrFlag,
  type FlagProps,
  MxFlag,
  PeFlag,
  UsFlag,
} from "../../icons/flags";

/** Countries supported by `InputPhone`. Add/remove here (+ a flag in
 *  `icons/flags.tsx`) — that's the whole change. Intentionally small for now. */
export type CountryCode = "CO" | "US" | "CA" | "MX" | "CR" | "PE";

export interface CountryDef {
  code: CountryCode;
  /** Calling code without `+`, e.g. `"57"`. Sourced from libphonenumber. */
  dialCode: string;
  /** Max national significant digits → drives the input `maxLength`. */
  nationalDigits: number;
  /** Optional fixed mask (`#` = a digit, other chars literal), e.g.
   *  `"(###) ###-####"`. When omitted, libphonenumber's `AsYouType`
   *  national formatting is used. */
  mask?: string;
  Flag: (props: FlagProps) => React.ReactElement;
}

/** Default order shown in the picker; `CO` first (the app default). */
export const SUPPORTED_COUNTRIES: readonly CountryCode[] = [
  "CO",
  "US",
  "CA",
  "MX",
  "CR",
  "PE",
];

const FLAGS: Record<CountryCode, (props: FlagProps) => React.ReactElement> = {
  CO: CoFlag,
  US: UsFlag,
  CA: CaFlag,
  MX: MxFlag,
  CR: CrFlag,
  PE: PeFlag,
};

const NATIONAL_DIGITS: Record<CountryCode, number> = {
  CO: 10,
  US: 10,
  CA: 10,
  MX: 10,
  CR: 8,
  PE: 9,
};

/**
 * Per-country display mask (`#` = a digit, other chars literal). Edit freely —
 * this is the single place to tune how each country's number is formatted.
 * Remove an entry to fall back to libphonenumber's `AsYouType` formatting.
 */
const MASKS: Partial<Record<CountryCode, string>> = {
  CO: "(###) ### ####", // (312) 218 6181
  US: "(###) ###-####", // (201) 555-0123
  CA: "(###) ###-####",
  MX: "(##) #### ####", //  (55) 1234 5678
  CR: "#### ####", //       8312 1234
  PE: "### ### ###", //     987 654 321
};

export const COUNTRIES: Record<CountryCode, CountryDef> = Object.fromEntries(
  SUPPORTED_COUNTRIES.map((code) => [
    code,
    {
      code,
      dialCode: getCountryCallingCode(code as LibCountryCode),
      nationalDigits: NATIONAL_DIGITS[code],
      mask: MASKS[code],
      Flag: FLAGS[code],
    } satisfies CountryDef,
  ]),
) as unknown as Record<CountryCode, CountryDef>;

export function isSupportedCountry(code: string): code is CountryCode {
  return code in COUNTRIES;
}
