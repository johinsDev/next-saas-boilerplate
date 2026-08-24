import { PushMessage } from "./push-message";
import type { PushSender } from "./sender";
import type { PushResponse } from "./types";

/**
 * Base class for typed push notifications. Subclass per use-case
 * (StampEarnedPush, RewardReadyPush, RedemptionConfirmedPush…) and
 * implement `prepare()`.
 *
 * @example
 *   export class StampEarnedPush extends BasePush {
 *     constructor(
 *       private readonly userId: string,
 *       private readonly stampsRemaining: number,
 *     ) { super(); }
 *
 *     async prepare() {
 *       this.message
 *         .toUser(this.userId)
 *         .title("¡Sumaste un sello!")
 *         .body(`Te ${this.stampsRemaining === 1 ? "falta 1" : `faltan ${this.stampsRemaining}`} para tu próximo bubble tea`)
 *         .clickAction("/card");
 *     }
 *   }
 */
export abstract class BasePush {
  #built = false;
  message = new PushMessage();

  /** Configure `this.message`. Called exactly once by `build()`. */
  abstract prepare(): void | Promise<void>;

  /**
   * Override to conditionally skip sending. Use from queue handlers
   * to gate on per-user opt-out or do-not-disturb windows.
   */
  shouldSend(): boolean | Promise<boolean> {
    return true;
  }

  /** Idempotent — multiple calls run `prepare()` only once. */
  async build(): Promise<void> {
    if (this.#built) return;
    this.#built = true;
    await this.prepare();
  }

  /** Called by `PushSender` when it receives a `BasePush` instance. */
  async send(sender: PushSender): Promise<PushResponse[]> {
    await this.build();
    return sender.sendCompiled(this.message.toData());
  }
}
