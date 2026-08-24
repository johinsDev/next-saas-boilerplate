import { describe, expect, it } from "vitest";

import {
  applyMask,
  digitsOnly,
  formatNational,
  isValidE164Phone,
  maxNationalLength,
  parseE164,
  toPhoneValue,
} from "../input-phone.lib";

describe("digitsOnly", () => {
  it("strips everything non-numeric", () => {
    expect(digitsOnly("+57 (312) 218-6181")).toBe("573122186181");
    expect(digitsOnly("abc")).toBe("");
  });
});

describe("maxNationalLength", () => {
  it("varies per country", () => {
    expect(maxNationalLength("CO")).toBe(10);
    expect(maxNationalLength("CR")).toBe(8);
    expect(maxNationalLength("PE")).toBe(9);
  });
});

describe("applyMask", () => {
  it("fills # with digits and keeps literals, stopping when digits run out", () => {
    expect(applyMask("3122186181", "(###) ###-####")).toBe("(312) 218-6181");
    expect(applyMask("312", "(###) ###-####")).toBe("(312");
    expect(applyMask("", "(###)")).toBe("");
  });
});

describe("formatNational", () => {
  it("applies the per-country mask (CO → parentheses + spaces)", () => {
    expect(formatNational("3122186181", "CO")).toBe("(312) 218 6181");
  });

  it("preserves the digits (only adds formatting)", () => {
    const out = formatNational("3122186181", "CO");
    expect(digitsOnly(out)).toBe("3122186181");
  });

  it("truncates beyond the country max length", () => {
    const out = formatNational("3122186181999", "CO"); // 13 digits, CO max 10
    expect(digitsOnly(out)).toBe("3122186181");
  });
});

describe("toPhoneValue", () => {
  it("builds E.164 + metadata for a full CO mobile", () => {
    const v = toPhoneValue("3001234567", "CO");
    expect(v.e164).toBe("+573001234567");
    expect(v.countryCode).toBe("CO");
    expect(v.dialCode).toBe("57");
    expect(v.nationalNumber).toBe("3001234567");
    expect(v.isPossible).toBe(true);
    expect(v.formatted.startsWith("+57 ")).toBe(true);
    expect(digitsOnly(v.national)).toBe("3001234567");
  });

  it("ignores non-digits in the input", () => {
    expect(toPhoneValue("(300) 123 4567", "CO").e164).toBe("+573001234567");
  });

  it("is empty for empty input", () => {
    const v = toPhoneValue("", "CO");
    expect(v.e164).toBe("");
    expect(v.formatted).toBe("");
    expect(v.isValid).toBe(false);
    expect(v.isPossible).toBe(false);
  });

  it("marks a too-short number as not possible / not valid", () => {
    const v = toPhoneValue("300", "CO");
    expect(v.isPossible).toBe(false);
    expect(v.isValid).toBe(false);
    expect(v.e164).toBe("+57300");
  });

  it("uses the dial code of the selected country (MX vs US)", () => {
    expect(toPhoneValue("5512345678", "MX").dialCode).toBe("52");
    expect(toPhoneValue("2015550123", "US").dialCode).toBe("1");
  });
});

describe("parseE164", () => {
  it("derives country + national digits from an E.164 string", () => {
    expect(parseE164("+573001234567")).toEqual({
      country: "CO",
      nationalNumber: "3001234567",
    });
  });

  it("returns null for unsupported country or unparseable input", () => {
    expect(parseE164("+442079460000")).toBeNull(); // GB — not in our list
    expect(parseE164("nonsense")).toBeNull();
  });
});

describe("isValidE164Phone", () => {
  it("accepts a valid CO mobile and rejects a too-short one", () => {
    expect(isValidE164Phone("+573001234567")).toBe(true);
    expect(isValidE164Phone("+5712")).toBe(false);
  });
});
