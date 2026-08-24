import { z } from "zod";

export const smsOutboxStatusSchema = z.enum(["sent", "failed"]);

/**
 * Zod input for `smsOutbox.list`. Filters that map to a method on
 * `SmsOutboxFilters` must share the key name (`to`, `status`, `search`).
 * Pagination is fixed: 1-based `page`, capped `pageSize`.
 */
export const listInputSchema = z.object({
  to: z.string().optional(),
  status: smsOutboxStatusSchema.optional(),
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

export type ListInput = z.infer<typeof listInputSchema>;
export type LatestForRecipientInput = z.infer<
  typeof latestForRecipientInputSchema
>;
export type SmsOutboxStatus = z.infer<typeof smsOutboxStatusSchema>;
