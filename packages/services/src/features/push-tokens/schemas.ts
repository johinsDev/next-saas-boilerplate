import { z } from "zod";

/**
 * Both push protocols share these enums. `webpush` tokens are the
 * JSON-stringified `PushSubscription` returned by the browser;
 * `expo` tokens are the `ExponentPushToken[…]` strings.
 */
export const pushPlatformSchema = z.enum(["webpush", "expo"]);

// `userId` + `organizationId` are resolved server-side from the session +
// the primary org (see the router) — never trusted from the client. The browser
// only sends the token payload.
export const registerInputSchema = z.object({
  platform: pushPlatformSchema,
  token: z.string().min(1),
  deviceLabel: z.string().max(255).optional(),
});

export const revokeInputSchema = z.object({
  token: z.string().min(1),
});

export const listForCustomerInputSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
});

/** Server-resolved identity attached to a register/revoke before it hits the repo. */
export interface PushTokenIdentity {
  userId: string;
  organizationId: string;
}

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type RevokeInput = z.infer<typeof revokeInputSchema>;
export type ListForCustomerInput = z.infer<typeof listForCustomerInputSchema>;
