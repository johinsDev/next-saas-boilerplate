import { z } from "zod";

export const createUploadUrlInputSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  disk: z.string().min(1).max(64).optional(),
  /** Bytes. Enforced server-side on the route handler for local/memory. */
  maxSize: z.number().int().positive().max(50 * 1024 * 1024).optional(),
});

export const createDownloadUrlInputSchema = z.object({
  key: z.string().min(1).max(1024),
  disk: z.string().min(1).max(64).optional(),
  /** Seconds. Capped at 1 hour. */
  expiresIn: z.number().int().min(1).max(3600).optional(),
});

export const deleteInputSchema = z.object({
  key: z.string().min(1).max(1024),
  disk: z.string().min(1).max(64).optional(),
});

export const listInputSchema = z.object({
  prefix: z.string().max(1024).optional(),
  disk: z.string().min(1).max(64).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
});

export type CreateUploadUrlInput = z.infer<typeof createUploadUrlInputSchema>;
export type CreateDownloadUrlInput = z.infer<typeof createDownloadUrlInputSchema>;
export type DeleteStorageInput = z.infer<typeof deleteInputSchema>;
export type ListStorageInput = z.infer<typeof listInputSchema>;
