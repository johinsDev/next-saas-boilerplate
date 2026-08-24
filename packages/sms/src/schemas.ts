import { z } from "zod";

/**
 * E.164 phone format: leading `+`, 1-15 digits.
 * Reused by `SmsMessage.to()` and `from()`.
 */
export const e164PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Phone must be E.164: + then 1-15 digits");

/**
 * SMS payload bounds. Twilio enforces 1600 chars on body; longer messages
 * fail with `21617` at send time. We surface the error pre-send.
 */
export const smsContentSchema = z
  .string()
  .min(1, "SMS content cannot be empty")
  .max(1600, "SMS content cannot exceed 1600 characters");

/**
 * GSM-7 alphabet. Characters outside this set force UCS-2 encoding,
 * which cuts the per-segment budget from 160 → 70 chars.
 *
 * Reference: https://en.wikipedia.org/wiki/GSM_03.38
 */
const GSM7_CHARS =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜabcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENDED = "^{}\\[~]|€";
const GSM7_SET = new Set([...GSM7_CHARS, ...GSM7_EXTENDED]);

export function isGsm7(text: string): boolean {
  for (const char of text) {
    if (!GSM7_SET.has(char)) return false;
  }
  return true;
}

export interface SegmentInfo {
  encoding: "GSM-7" | "UCS-2";
  characters: number;
  segments: number;
  maxPerSegment: number;
}

/**
 * Carrier-billable segment count for a body. Used by the folder/outbox
 * previews and any cost-aware caller.
 *
 * Rules:
 *   - GSM-7 single → 160 chars; concat → 153 chars each.
 *   - UCS-2 single → 70 chars; concat → 67 chars each.
 *   - GSM-7 extended chars (`^{}\[~]|€`) count as 2.
 */
export function smsSegmentInfo(text: string): SegmentInfo {
  const gsm7 = isGsm7(text);
  const encoding = gsm7 ? ("GSM-7" as const) : ("UCS-2" as const);

  let charCount: number;
  if (gsm7) {
    charCount = 0;
    for (const char of text) {
      charCount += GSM7_EXTENDED.includes(char) ? 2 : 1;
    }
  } else {
    charCount = text.length;
  }

  const singleMax = gsm7 ? 160 : 70;
  const concatMax = gsm7 ? 153 : 67;

  const segments = charCount <= singleMax ? 1 : Math.ceil(charCount / concatMax);

  return {
    encoding,
    characters: charCount,
    segments,
    maxPerSegment: charCount <= singleMax ? singleMax : concatMax,
  };
}
