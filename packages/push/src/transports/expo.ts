import {
  InvalidTokenError,
  MissingDependencyError,
  ProviderError,
  RateLimitError,
  SubscriptionExpiredError,
} from "../errors";
import { dynamicImport } from "./_lazy";
import type {
  ExpoProviderConfig,
  PushMessageData,
  PushResponse,
  PushTransport,
  ResolvedRecipient,
} from "../types";

function asMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Native-app production transport. Sends via Expo's Push Notification
 * Service (https://exp.host/--/api/v2/push/send). Expo wraps FCM
 * (Android) and APNs (iOS) so we don't have to handle either directly.
 *
 * Lazy-loads `expo-server-sdk` on first send so the package can be
 * imported without the SDK installed.
 *
 * Maps:
 *   - `Expo.isExpoPushToken === false` → `InvalidTokenError`
 *   - Ticket `details.error === "DeviceNotRegistered"` → `SubscriptionExpiredError`
 *   - Ticket `details.error === "MessageRateExceeded"` → `RateLimitError`
 *   - Other ticket errors → `ProviderError`
 */
export class ExpoTransport implements PushTransport {
  readonly name = "expo";
  readonly #config: ExpoProviderConfig;
  #client: ExpoClientLike | undefined;
  #ExpoStaticRef: ExpoStaticLike | undefined;

  constructor(config: ExpoProviderConfig) {
    this.#config = config;
  }

  async #getClient(): Promise<{
    client: ExpoClientLike;
    isToken: (s: string) => boolean;
  }> {
    if (this.#client && this.#ExpoStaticRef) {
      return {
        client: this.#client,
        isToken: this.#ExpoStaticRef.isExpoPushToken,
      };
    }
    let mod: { Expo: ExpoStaticLike };
    try {
      // `dynamicImport` uses Function-constructor indirection so the
      // bundler can't trace this optional peer dep at compile time.
      mod = (await dynamicImport("expo-server-sdk")) as unknown as typeof mod;
    } catch {
      throw new MissingDependencyError("expo", "expo-server-sdk");
    }
    this.#ExpoStaticRef = mod.Expo;
    this.#client = new mod.Expo({ accessToken: this.#config.accessToken });
    return { client: this.#client, isToken: mod.Expo.isExpoPushToken };
  }

  async send(
    message: PushMessageData,
    recipient: ResolvedRecipient,
  ): Promise<PushResponse> {
    const { client, isToken } = await this.#getClient();

    if (!isToken(recipient.token)) {
      throw new InvalidTokenError(`"${recipient.token.slice(0, 32)}…" is not a valid Expo push token`);
    }

    const expoMessage: Record<string, unknown> = {
      to: recipient.token,
      title: message.title,
      body: message.body,
      sound: message.sound ?? "default",
    };
    if (message.data) expoMessage.data = message.data;
    if (message.badge !== undefined) expoMessage.badge = message.badge;
    if (message.ttl !== undefined) expoMessage.ttl = message.ttl;
    if (message.priority === "high") expoMessage.priority = "high";
    if (message.priority === "normal" || message.priority === "default") {
      expoMessage.priority = "default";
    }

    let tickets: ExpoTicketLike[];
    try {
      tickets = await client.sendPushNotificationsAsync([expoMessage]);
    } catch (error: unknown) {
      throw new ProviderError(this.name, asMessage(error), undefined, error);
    }

    const ticket = tickets[0];
    if (!ticket) {
      throw new ProviderError(this.name, "Expo returned no ticket");
    }

    if (ticket.status === "error") {
      const code = ticket.details?.error;
      if (code === "DeviceNotRegistered") {
        throw new SubscriptionExpiredError(recipient.token);
      }
      if (code === "MessageRateExceeded") {
        throw new RateLimitError(60_000);
      }
      throw new ProviderError(
        this.name,
        ticket.message ?? "Expo push send failed",
        code,
      );
    }

    return {
      status: "sent",
      providerMessageId: ticket.id,
      provider: this.name,
      platform: "expo",
      token: recipient.token,
      timestamp: new Date().toISOString(),
    };
  }
}

interface ExpoStaticLike {
  new (options: { accessToken?: string }): ExpoClientLike;
  isExpoPushToken(token: string): boolean;
}

interface ExpoClientLike {
  sendPushNotificationsAsync(
    messages: Record<string, unknown>[],
  ): Promise<ExpoTicketLike[]>;
}

interface ExpoTicketLike {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}
