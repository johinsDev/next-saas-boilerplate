import { z } from "zod";

/**
 * The contract. Everything else in the slice agrees on what is in this file —
 * the repository returns it, the service takes it, and the API validates
 * against it.
 */
export const organizationSettingsInput = z.object({
  organizationId: z.string().min(1),
  defaultLocale: z.string().min(2).max(10),
  currency: z.string().length(3),
  timezone: z.string().min(1),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
});

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsInput>;
