import { z } from "zod";

export const emailOutboxStatusSchema = z.enum(["sent", "failed"]);

/**
 * Zod input for `emailOutbox.list`. Filters that map to a method on
 * `EmailOutboxFilters` must share the key name (`to`, `status`,
 * `search`). Pagination is fixed: 1-based `page`, capped `pageSize`.
 */
export const listInputSchema = z.object({
  to: z.string().optional(),
  status: emailOutboxStatusSchema.optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const getInputSchema = z.object({
  id: z.string().uuid(),
});

export const latestForRecipientInputSchema = z.object({
  to: z.string(),
  limit: z.number().int().min(1).max(20).default(5),
});

/** Force a specific transport from the dev tool; omit for the env default. */
export const sendTestMailerSchema = z.enum(["log", "outbox", "resend"]);

/**
 * Zod input for `emailOutbox.sendTest`. `templateId` mirrors
 * `TEST_EMAIL_TEMPLATE_IDS` in `@saas/email-templates` (kept as a
 * literal here so the API Worker never imports the React templates).
 */
const sendTestSharedFields = {
  to: z.string().email(),
  mailer: sendTestMailerSchema.optional(),
};

export const sendTestInputSchema = z.discriminatedUnion("mode", [
  z.object({
    ...sendTestSharedFields,
    mode: z.literal("template"),
    templateId: z.enum(["welcome", "magic-link"]),
  }),
  z.object({
    ...sendTestSharedFields,
    mode: z.literal("custom"),
    subject: z.string().min(1).max(200),
    html: z.string().min(1).max(100_000),
  }),
]);

export type ListInput = z.infer<typeof listInputSchema>;
export type LatestForRecipientInput = z.infer<
  typeof latestForRecipientInputSchema
>;
export type EmailOutboxStatus = z.infer<typeof emailOutboxStatusSchema>;
