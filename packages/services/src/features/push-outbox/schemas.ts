import { z } from "zod";

export const pushOutboxStatusSchema = z.enum(["sent", "failed"]);
export const pushPlatformSchema = z.enum(["webpush", "expo"]);

/**
 * Zod input for `pushOutbox.list`. Filters that map to a method on
 * `PushOutboxFilters` must share the key name (`deviceToken`,
 * `platform`, `status`, `search`).
 */
export const listInputSchema = z.object({
  deviceToken: z.string().optional(),
  platform: pushPlatformSchema.optional(),
  status: pushOutboxStatusSchema.optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const getInputSchema = z.object({
  id: z.string().uuid(),
});

export const latestForRecipientInputSchema = z.object({
  deviceToken: z.string(),
  limit: z.number().int().min(1).max(20).default(5),
});

export type ListInput = z.infer<typeof listInputSchema>;
export type LatestForRecipientInput = z.infer<
  typeof latestForRecipientInputSchema
>;
export type PushOutboxStatus = z.infer<typeof pushOutboxStatusSchema>;
export type PushPlatformInput = z.infer<typeof pushPlatformSchema>;
