import { z } from "zod";

/** Manual create from the admin UI. `slug` optional → auto-generated. */
export const createInputSchema = z.object({
  targetUrl: z.string().url(),
  slug: z
    .string()
    .regex(/^[0-9A-Za-z]{1,64}$/, "Base62, 1–64 chars")
    .optional(),
  expiresAt: z.coerce.date().optional(),
});

export const listInputSchema = z.object({
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const idInputSchema = z.object({ id: z.string().uuid() });

export const analyticsInputSchema = z.object({
  id: z.string().uuid(),
  sinceDays: z.number().int().min(1).max(90).default(30),
});

export type ListInput = z.infer<typeof listInputSchema>;
export type AnalyticsInput = z.infer<typeof analyticsInputSchema>;
