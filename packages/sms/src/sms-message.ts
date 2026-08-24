import { InvalidMessageError, InvalidPhoneNumberError } from "./errors";
import {
  type SegmentInfo,
  e164PhoneSchema,
  smsContentSchema,
  smsSegmentInfo,
} from "./schemas";
import type { SmsMessageData } from "./types";

/**
 * Fluent builder for an SMS. Mutable; chain calls then `toData()` to
 * produce the wire payload. Validated at `toData()` time so partial
 * builds during prep are fine.
 *
 * @example
 *   const data = new SmsMessage()
 *     .to("+5491155555555")
 *     .content("Tu codigo es 847291. Expira en 5 minutos.")
 *     .toData();
 */
export class SmsMessage {
  #to?: string;
  #from?: string;
  #parts: string[] = [];

  to(phone: string): this {
    const result = e164PhoneSchema.safeParse(phone);
    if (!result.success) throw new InvalidPhoneNumberError(phone);
    this.#to = result.data;
    return this;
  }

  from(phone: string): this {
    const result = e164PhoneSchema.safeParse(phone);
    if (!result.success) throw new InvalidPhoneNumberError(phone);
    this.#from = result.data;
    return this;
  }

  /** Append plain text. Multiple calls concatenate. */
  content(text: string): this {
    this.#parts.push(text);
    return this;
  }

  /** Append a newline. SMS supports `\n` (counts toward segment budget). */
  line(): this {
    this.#parts.push("\n");
    return this;
  }

  /**
   * Segment info for the current content. Returns `null` if nothing has
   * been added yet. Useful for cost previews before sending.
   */
  get segmentInfo(): SegmentInfo | null {
    const text = this.#parts.join("");
    if (!text) return null;
    return smsSegmentInfo(text);
  }

  /**
   * Compile to the wire payload. Throws if recipient missing or content
   * fails the length check.
   */
  toData(): SmsMessageData {
    if (!this.#to) {
      throw new InvalidMessageError("Recipient (to) is required");
    }

    const content = this.#parts.join("");
    if (!content) {
      throw new InvalidMessageError("Content is required");
    }

    const result = smsContentSchema.safeParse(content);
    if (!result.success) {
      throw new InvalidMessageError(
        result.error.issues[0]?.message ?? "Invalid content",
      );
    }

    return {
      to: this.#to,
      ...(this.#from && { from: this.#from }),
      content,
    };
  }
}
