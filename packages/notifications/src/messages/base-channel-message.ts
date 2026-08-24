/**
 * Optional base class for expressing a channel message as its own class —
 * e.g. `class NewUserSms extends BaseChannelMessage<SmsContract>`. A
 * notification's `toX()` may return either a plain contract object or an
 * instance of one of these; `normalizeContract()` collapses both to the
 * plain contract the channel adapter consumes.
 *
 * @example
 *   class NewUserSms extends BaseChannelMessage<SmsContract> {
 *     constructor(private readonly name: string) { super(); }
 *     toContract(): SmsContract {
 *       return { body: `¡Bienvenido a Acme, ${this.name}!` };
 *     }
 *   }
 *   // in a Notification:
 *   toSms() { return new NewUserSms(this.name); }
 */
export abstract class BaseChannelMessage<C> {
  /** Build the plain contract. Called once by the channel during normalize. */
  abstract toContract(): C | Promise<C>;
}

/** A `toX()` return: the contract object directly, or a class wrapping it. */
export type ChannelReturn<C> = C | BaseChannelMessage<C>;

export function isChannelMessage<C>(
  value: unknown,
): value is BaseChannelMessage<C> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toContract?: unknown }).toContract === "function"
  );
}

/** Normalize a `toX()` return to its plain contract. */
export async function normalizeContract<C>(
  value: ChannelReturn<C>,
): Promise<C> {
  return isChannelMessage<C>(value) ? await value.toContract() : value;
}
