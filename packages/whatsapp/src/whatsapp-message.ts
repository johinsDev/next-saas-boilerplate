import { InvalidMessageError, InvalidPhoneNumberError } from "./errors";
import { e164PhoneSchema, whatsappContentSchema } from "./schemas";
import type { WhatsAppMessageData } from "./types";

const emojiMap: Record<string, string> = {
  check: "✅",
  lock: "🔒",
  key: "🔑",
  wave: "👋",
  rocket: "🚀",
  warning: "⚠️",
  bell: "🔔",
  star: "⭐",
  heart: "❤️",
  fire: "🔥",
  sparkles: "✨",
  shield: "🛡️",
  clock: "⏰",
  package: "📦",
  thumbsup: "👍",
  tada: "🎉",
  cup: "🍵",
  tea: "🍵",
};

/**
 * Fluent builder for a WhatsApp message. Mutable; chain calls then
 * `toData()` to produce the wire payload. Validated at `toData()` time
 * so partial builds during prep are fine.
 *
 * @example
 *   const data = new WhatsAppMessage()
 *     .to("+5491155555555")
 *     .emoji("tea")
 *     .content(" Hola, ")
 *     .bold("Lucía")
 *     .content(" — te llegaron 2 sellos.")
 *     .toData();
 */
export class WhatsAppMessage {
  #to?: string;
  #from?: string;
  #parts: string[] = [];
  #mediaUrl?: string;
  #contentSid?: string;
  #contentVariables?: Record<string, string>;

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

  content(text: string): this {
    this.#parts.push(text);
    return this;
  }

  bold(text: string): this {
    this.#parts.push(`*${text}*`);
    return this;
  }

  italic(text: string): this {
    this.#parts.push(`_${text}_`);
    return this;
  }

  boldItalic(text: string): this {
    this.#parts.push(`*_${text}_*`);
    return this;
  }

  strike(text: string): this {
    this.#parts.push(`~${text}~`);
    return this;
  }

  mono(text: string): this {
    this.#parts.push(`\`${text}\``);
    return this;
  }

  codeBlock(text: string): this {
    this.#parts.push(`\`\`\`${text}\`\`\``);
    return this;
  }

  line(): this {
    this.#parts.push("\n");
    return this;
  }

  /**
   * Attach a publicly accessible media URL. Twilio fetches the URL
   * server-side, so signed URLs / private hosts won't work.
   */
  media(url: string): this {
    this.#mediaUrl = url;
    return this;
  }

  /**
   * Use a Twilio Content Template (HSM template approved by WhatsApp)
   * instead of a freeform body. Templates can be sent outside the
   * 24-hour customer-service window.
   */
  template(sid: string, variables?: Record<string, string>): this {
    this.#contentSid = sid;
    this.#contentVariables = variables;
    return this;
  }

  emoji(name: string): this {
    const char = emojiMap[name];
    if (!char) {
      throw new InvalidMessageError(
        `Unknown emoji "${name}". Available: ${Object.keys(emojiMap).join(", ")}`,
      );
    }
    this.#parts.push(char);
    return this;
  }

  /**
   * Compile to the wire payload. Throws if recipient missing or content
   * fails the length check.
   */
  toData(): WhatsAppMessageData {
    if (!this.#to) {
      throw new InvalidMessageError("Recipient (to) is required");
    }

    if (this.#contentSid) {
      return {
        to: this.#to,
        ...(this.#from && { from: this.#from }),
        content:
          this.#parts.length > 0 ? this.#parts.join("") : "[Content Template]",
        ...(this.#mediaUrl && { mediaUrl: this.#mediaUrl }),
        contentSid: this.#contentSid,
        ...(this.#contentVariables && {
          contentVariables: this.#contentVariables,
        }),
      };
    }

    const content = this.#parts.join("");
    if (!content && !this.#mediaUrl) {
      throw new InvalidMessageError("Content or media is required");
    }

    if (content) {
      const result = whatsappContentSchema.safeParse(content);
      if (!result.success) {
        throw new InvalidMessageError(
          result.error.issues[0]?.message ?? "Invalid content",
        );
      }
    }

    return {
      to: this.#to,
      ...(this.#from && { from: this.#from }),
      content,
      ...(this.#mediaUrl && { mediaUrl: this.#mediaUrl }),
    };
  }
}
