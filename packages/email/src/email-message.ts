import { InvalidEmailError, InvalidMessageError } from "./errors";
import {
  emailAddressSchema,
  emailSubjectSchema,
  type EmailPriorityLevel,
} from "./schemas";
import type {
  EmailAttachment,
  EmailMessageData,
  EmailTag,
  Recipient,
} from "./types";

function validateAddress(value: Recipient): Recipient {
  const addr = typeof value === "string" ? value : value.address;
  const result = emailAddressSchema.safeParse(addr);
  if (!result.success) throw new InvalidEmailError(addr);
  return value;
}

/**
 * Fluent builder for an email. Mutable; chain calls then `toData()` to
 * produce the wire payload. Validated at `toData()` time so partial
 * builds during prep are fine.
 *
 * @example
 *   const data = new EmailMessage()
 *     .to("lucia@example.com", "Lucia")
 *     .from("notifications@acme.app", "Acme")
 *     .subject("Bienvenida")
 *     .html(renderedHtml)
 *     .text("Bienvenida a Acme. Pasá por tu tarjeta digital.")
 *     .toData();
 */
export class EmailMessage {
  #to: Recipient[] = [];
  #from?: Recipient;
  #replyTo?: Recipient;
  #cc: Recipient[] = [];
  #bcc: Recipient[] = [];
  #subject?: string;
  #html?: string;
  #text?: string;
  #headers: Record<string, string> = {};
  #tags: EmailTag[] = [];
  #priority?: EmailPriorityLevel;
  #attachments: EmailAttachment[] = [];

  to(address: string, name?: string): this;
  to(recipient: Recipient): this;
  to(addressOrRecipient: string | Recipient, name?: string): this {
    const recipient =
      typeof addressOrRecipient === "string"
        ? name
          ? { address: addressOrRecipient, name }
          : addressOrRecipient
        : addressOrRecipient;
    this.#to.push(validateAddress(recipient));
    return this;
  }

  from(address: string, name?: string): this;
  from(recipient: Recipient): this;
  from(addressOrRecipient: string | Recipient, name?: string): this {
    const recipient =
      typeof addressOrRecipient === "string"
        ? name
          ? { address: addressOrRecipient, name }
          : addressOrRecipient
        : addressOrRecipient;
    this.#from = validateAddress(recipient);
    return this;
  }

  replyTo(address: string, name?: string): this;
  replyTo(recipient: Recipient): this;
  replyTo(addressOrRecipient: string | Recipient, name?: string): this {
    const recipient =
      typeof addressOrRecipient === "string"
        ? name
          ? { address: addressOrRecipient, name }
          : addressOrRecipient
        : addressOrRecipient;
    this.#replyTo = validateAddress(recipient);
    return this;
  }

  cc(address: string, name?: string): this;
  cc(recipient: Recipient): this;
  cc(addressOrRecipient: string | Recipient, name?: string): this {
    const recipient =
      typeof addressOrRecipient === "string"
        ? name
          ? { address: addressOrRecipient, name }
          : addressOrRecipient
        : addressOrRecipient;
    this.#cc.push(validateAddress(recipient));
    return this;
  }

  bcc(address: string, name?: string): this;
  bcc(recipient: Recipient): this;
  bcc(addressOrRecipient: string | Recipient, name?: string): this {
    const recipient =
      typeof addressOrRecipient === "string"
        ? name
          ? { address: addressOrRecipient, name }
          : addressOrRecipient
        : addressOrRecipient;
    this.#bcc.push(validateAddress(recipient));
    return this;
  }

  subject(text: string): this {
    const result = emailSubjectSchema.safeParse(text);
    if (!result.success) {
      throw new InvalidMessageError(
        result.error.issues[0]?.message ?? "Invalid subject",
      );
    }
    this.#subject = result.data;
    return this;
  }

  html(content: string): this {
    this.#html = content;
    return this;
  }

  text(content: string): this {
    this.#text = content;
    return this;
  }

  header(key: string, value: string): this {
    this.#headers[key] = value;
    return this;
  }

  tag(name: string, value: string): this {
    this.#tags.push({ name, value });
    return this;
  }

  priority(level: EmailPriorityLevel): this {
    this.#priority = level;
    return this;
  }

  attach(attachment: EmailAttachment): this {
    this.#attachments.push(attachment);
    return this;
  }

  /** Compile to the wire payload. Throws on missing recipient/subject/body. */
  toData(): EmailMessageData {
    if (this.#to.length === 0) {
      throw new InvalidMessageError("At least one recipient (to) is required");
    }
    if (!this.#subject) {
      throw new InvalidMessageError("Subject is required");
    }
    if (!this.#html && !this.#text) {
      throw new InvalidMessageError(
        "Either html or text body is required",
      );
    }

    return {
      to: [...this.#to],
      ...(this.#from && { from: this.#from }),
      ...(this.#replyTo && { replyTo: this.#replyTo }),
      ...(this.#cc.length > 0 && { cc: [...this.#cc] }),
      ...(this.#bcc.length > 0 && { bcc: [...this.#bcc] }),
      subject: this.#subject,
      ...(this.#html && { html: this.#html }),
      ...(this.#text && { text: this.#text }),
      ...(Object.keys(this.#headers).length > 0 && { headers: { ...this.#headers } }),
      ...(this.#tags.length > 0 && { tags: [...this.#tags] }),
      ...(this.#priority && { priority: this.#priority }),
      ...(this.#attachments.length > 0 && { attachments: [...this.#attachments] }),
    };
  }
}
