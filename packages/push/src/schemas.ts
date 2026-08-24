import { z } from "zod";

/**
 * Which underlying push protocol a token speaks. `webpush` = browser
 * via VAPID + Service Worker, `expo` = Expo's native push service.
 */
export const pushPlatformSchema = z.enum(["webpush", "expo"]);
export type PushPlatform = z.infer<typeof pushPlatformSchema>;

/**
 * An Expo push token always looks like `ExponentPushToken[xxxxxx]` or
 * the older `ExpoPushToken[…]`. We accept both forms.
 */
export const expoTokenSchema = z
  .string()
  .regex(
    /^(?:ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/,
    "Invalid Expo push token (expected ExponentPushToken[...])",
  );

/**
 * Canonical browser PushSubscription shape returned by
 * `pushManager.subscribe(...).toJSON()`. We persist this as a JSON
 * string in the `push_token.token` column for webpush rows.
 */
export const webPushSubscriptionSchema = z.object({
  endpoint: z.string().url("Invalid push subscription endpoint"),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  expirationTime: z.number().nullable().optional(),
});
export type WebPushSubscriptionJson = z.infer<typeof webPushSubscriptionSchema>;

export const pushTitleSchema = z
  .string()
  .min(1, "Push title cannot be empty")
  .max(120, "Push title cannot exceed 120 characters");

export const pushBodySchema = z
  .string()
  .min(1, "Push body cannot be empty")
  .max(4000, "Push body cannot exceed 4000 characters (web push payload limit ~4KB)");

export const pushPrioritySchema = z.enum(["default", "normal", "high"]);
export type PushPriorityLevel = z.infer<typeof pushPrioritySchema>;
