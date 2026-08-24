import { z } from "zod";

/**
 * RFC 5321 / 5322-compatible email address. Used by `EmailMessage`'s
 * recipient setters and by the OutboxTransport for to/from validation.
 */
export const emailAddressSchema = z.string().email("Invalid email address");

/**
 * RFC 2822 limits Subject headers to 998 chars per line. Most clients
 * truncate at ~78 visible chars but we only enforce the protocol max
 * to stay liberal in what we accept.
 */
export const emailSubjectSchema = z
  .string()
  .min(1, "Subject cannot be empty")
  .max(998, "Subject cannot exceed 998 characters (RFC 2822)");

export const emailContentSchema = z
  .string()
  .min(1, "Email content cannot be empty");

export type EmailPriorityLevel = "low" | "normal" | "high";

/**
 * RFC 1911 / commonly accepted priority levels mapped to the
 * `X-Priority` header transports inject. `normal` (3) is the default
 * and most clients ignore it.
 */
export function priorityToXPriority(level: EmailPriorityLevel): string {
  if (level === "high") return "1";
  if (level === "low") return "5";
  return "3";
}
