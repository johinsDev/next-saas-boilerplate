import { isOptOutable } from "./types";
import type { ChannelName, NotificationCategory } from "./types";

/**
 * Resolves a customer's per-channel opt-outs. The concrete Drizzle
 * implementation lives in the app/jobs bootstrap; the package ships only this
 * interface. Absence of an opt-out = subscribed (opt-out is the explicit
 * state), so the repository returns only the channels the customer turned off.
 */
export interface PreferencesRepository {
  /**
   * The set of channels the customer has opted OUT of for opt-outable
   * categories. Empty set = no opt-outs.
   */
  optedOutChannels(
    customerId: string,
    organizationId: string,
  ): Promise<Set<ChannelName>>;
}

/**
 * Decide which of the declared channels are allowed to send.
 *
 *   - Non-opt-outable categories (transactional, otp, …) → every declared
 *     channel passes. These can never be suppressed.
 *   - `marketing` → allowed = declared − optedOut.
 */
export async function resolveChannels(args: {
  declared: readonly ChannelName[];
  category: NotificationCategory;
  customerId: string;
  organizationId: string;
  preferences: PreferencesRepository;
}): Promise<Set<ChannelName>> {
  if (!isOptOutable(args.category)) {
    return new Set(args.declared);
  }
  const optedOut = await args.preferences.optedOutChannels(
    args.customerId,
    args.organizationId,
  );
  return new Set(args.declared.filter((c) => !optedOut.has(c)));
}
