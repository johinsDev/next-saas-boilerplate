import type { Notification, NotificationRenderers } from "../notification";
import type { ChannelResult, ResolvedNotifiable } from "../types";

/**
 * A channel adapts one `(notification, recipient)` pair into a delivery via
 * some injected transport. `method` names the `Notification` hook it reads
 * (e.g. `"toMail"`); the engine reports `skipped / no-method` when that hook
 * is absent. Implement this interface + register a key to add a channel.
 */
export interface NotificationChannel {
  readonly name: string;
  /** The renderer method this channel consumes (e.g. `"toMail"`). */
  readonly method: keyof NotificationRenderers;
  send(
    notification: Notification,
    notifiable: ResolvedNotifiable,
  ): Promise<ChannelResult>;
}

/** Registry of channels keyed by name, injected into the `Notifier`. */
export type ChannelRegistry = Record<string, NotificationChannel>;
