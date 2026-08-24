import { z } from "zod";

/**
 * E.164 phone format: leading `+`, 1-15 digits.
 * Reused by `WhatsAppMessage.to()` and `from()`.
 */
export const e164PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Phone must be E.164: + then 1-15 digits");

export const whatsappContentSchema = z
  .string()
  .min(1, "WhatsApp content cannot be empty")
  .max(4096, "WhatsApp content cannot exceed 4096 characters");

export function bold(text: string): string {
  return `*${text}*`;
}

export function italic(text: string): string {
  return `_${text}_`;
}

export function boldItalic(text: string): string {
  return `*_${text}_*`;
}

export function strike(text: string): string {
  return `~${text}~`;
}

export function mono(text: string): string {
  return `\`${text}\``;
}

export function codeBlock(text: string): string {
  return `\`\`\`${text}\`\`\``;
}
