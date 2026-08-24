import { InvalidMessageError, InvalidTokenError } from "./errors";
import {
  expoTokenSchema,
  pushBodySchema,
  pushPlatformSchema,
  pushTitleSchema,
  webPushSubscriptionSchema,
  type PushPlatform,
  type PushPriorityLevel,
} from "./schemas";
import type { PushMessageData, PushRecipient } from "./types";

function validateTokenForPlatform(token: string, platform: PushPlatform): void {
  if (platform === "expo") {
    const result = expoTokenSchema.safeParse(token);
    if (!result.success) {
      throw new InvalidTokenError(
        result.error.issues[0]?.message ?? "Invalid Expo token",
      );
    }
    return;
  }
  // webpush — token is a JSON-stringified WebPushSubscription
  let parsed: unknown;
  try {
    parsed = JSON.parse(token);
  } catch {
    throw new InvalidTokenError(
      "Web push token must be a JSON-stringified PushSubscription",
    );
  }
  const result = webPushSubscriptionSchema.safeParse(parsed);
  if (!result.success) {
    throw new InvalidTokenError(
      result.error.issues[0]?.message ?? "Invalid web push subscription",
    );
  }
}

/**
 * Fluent builder for a push notification. Mutable; chain calls then
 * `toData()` to produce the wire payload. Validated at `toData()`
 * time so partial builds during prep are fine.
 *
 * @example
 *   const data = new PushMessage()
 *     .toUser(user.id)
 *     .title("¡Sumaste un sello!")
 *     .body("Te falta 1 para tu próximo bubble tea")
 *     .data({ deepLink: "/card" })
 *     .clickAction("https://t4.app/card")
 *     .toData();
 */
export class PushMessage {
  #recipients: PushRecipient[] = [];
  #title?: string;
  #body?: string;
  #data?: Record<string, unknown>;
  #badge?: number;
  #icon?: string;
  #image?: string;
  #sound?: string;
  #clickAction?: string;
  #ttl?: number;
  #priority?: PushPriorityLevel;

  /** Send to a specific device by token + platform. */
  toToken(token: string, platform: PushPlatform): this {
    const platformResult = pushPlatformSchema.safeParse(platform);
    if (!platformResult.success) {
      throw new InvalidTokenError(`Unknown platform: ${platform}`);
    }
    validateTokenForPlatform(token, platform);
    this.#recipients.push({ kind: "token", token, platform });
    return this;
  }

  /** Send to a user — sender resolves to all of their active tokens. */
  toUser(userId: string): this {
    if (!userId) throw new InvalidMessageError("userId is required");
    this.#recipients.push({ kind: "user", userId });
    return this;
  }

  title(text: string): this {
    const result = pushTitleSchema.safeParse(text);
    if (!result.success) {
      throw new InvalidMessageError(
        result.error.issues[0]?.message ?? "Invalid title",
      );
    }
    this.#title = result.data;
    return this;
  }

  body(text: string): this {
    const result = pushBodySchema.safeParse(text);
    if (!result.success) {
      throw new InvalidMessageError(
        result.error.issues[0]?.message ?? "Invalid body",
      );
    }
    this.#body = result.data;
    return this;
  }

  data(payload: Record<string, unknown>): this {
    this.#data = { ...this.#data, ...payload };
    return this;
  }

  badge(count: number): this {
    this.#badge = count;
    return this;
  }

  icon(url: string): this {
    this.#icon = url;
    return this;
  }

  image(url: string): this {
    this.#image = url;
    return this;
  }

  sound(name: string): this {
    this.#sound = name;
    return this;
  }

  clickAction(url: string): this {
    this.#clickAction = url;
    return this;
  }

  ttl(seconds: number): this {
    this.#ttl = seconds;
    return this;
  }

  priority(level: PushPriorityLevel): this {
    this.#priority = level;
    return this;
  }

  /** Compile to the wire payload. Throws on missing recipient/title/body. */
  toData(): PushMessageData {
    if (this.#recipients.length === 0) {
      throw new InvalidMessageError("At least one recipient is required");
    }
    if (!this.#title) {
      throw new InvalidMessageError("Title is required");
    }
    if (!this.#body) {
      throw new InvalidMessageError("Body is required");
    }

    return {
      recipients: [...this.#recipients],
      title: this.#title,
      body: this.#body,
      ...(this.#data && Object.keys(this.#data).length > 0 && { data: { ...this.#data } }),
      ...(this.#badge !== undefined && { badge: this.#badge }),
      ...(this.#icon && { icon: this.#icon }),
      ...(this.#image && { image: this.#image }),
      ...(this.#sound && { sound: this.#sound }),
      ...(this.#clickAction && { clickAction: this.#clickAction }),
      ...(this.#ttl !== undefined && { ttl: this.#ttl }),
      ...(this.#priority && { priority: this.#priority }),
    };
  }
}
