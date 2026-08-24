import { ProviderError, RateLimitError } from "../errors";
import type {
  TwilioWhatsAppProviderConfig,
  WhatsAppMessageData,
  WhatsAppResponse,
  WhatsAppTransport,
} from "../types";
import { dynamicImport } from "./_lazy";

const VERIFY_DELAY_MS = 2_000;

/**
 * Maps the most common Twilio WhatsApp error codes to operator-friendly
 * messages. Not exhaustive — full list at
 * https://www.twilio.com/docs/api/errors#5-anchor — but covers
 * sandbox setup, opt-in, and template restrictions.
 */
function twilioErrorMessage(code: number | null, fallback?: string): string {
  if (code === 63007) return "WhatsApp sender not registered for this number.";
  if (code === 63015) return "Recipient not in Twilio sandbox / not opted in.";
  if (code === 63016)
    return "Outside 24-hour window — use an approved Content Template.";
  if (code === 63017)
    return "Recipient is on the WhatsApp blocked-senders list.";
  if (code === 63020) return "Media URL not publicly accessible.";
  if (code === 63027) return "Template parameter count mismatch.";
  return fallback ?? "Twilio delivery failed.";
}

/**
 * Production transport. Sends via Twilio's Messages API.
 *
 * Lazy-loads the `twilio` SDK on first send so the package can be
 * imported (e.g. by tests using the log/outbox transports) without
 * twilio installed.
 */
export class TwilioTransport implements WhatsAppTransport {
  readonly name = "twilio";
  readonly #config: TwilioWhatsAppProviderConfig;
  #client: unknown;

  constructor(config: TwilioWhatsAppProviderConfig) {
    this.#config = config;
  }

  async #getClient(): Promise<TwilioClientLike> {
    if (!this.#client) {
      // `twilio` is an optional peer dep. Function-constructor
      // indirection in `_lazy.ts` keeps Turbopack / Webpack from
      // tracing the specifier statically.
      const twilio = (await dynamicImport("twilio")) as unknown as {
        default: (
          accountSid: string,
          authToken: string,
        ) => TwilioClientLike;
      };
      this.#client = twilio.default(
        this.#config.accountSid,
        this.#config.authToken,
      );
    }
    return this.#client as TwilioClientLike;
  }

  async send(message: WhatsAppMessageData): Promise<WhatsAppResponse> {
    const client = await this.#getClient();
    const from = message.from ? `whatsapp:${message.from}` : this.#config.from;

    try {
      const mediaUrl = message.mediaUrl ? [message.mediaUrl] : undefined;

      const result = message.contentSid
        ? await client.messages.create({
            to: `whatsapp:${message.to}`,
            from,
            contentSid: message.contentSid,
            contentVariables: message.contentVariables
              ? JSON.stringify(message.contentVariables)
              : undefined,
          })
        : await client.messages.create({
            to: `whatsapp:${message.to}`,
            from,
            body: message.content || undefined,
            mediaUrl,
          });

      if (!this.#config.skipVerify) {
        await this.#verifyDelivery(client, result.sid);
      }

      return {
        status: result.status === "queued" ? "queued" : "sent",
        providerMessageId: result.sid,
        provider: this.name,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      if (error instanceof ProviderError || error instanceof RateLimitError) {
        throw error;
      }
      if (error && typeof error === "object" && "status" in error) {
        const twilioError = error as {
          status: number;
          code: number;
          message: string;
        };
        if (twilioError.status === 429) throw new RateLimitError(60_000);
        throw new ProviderError(
          this.name,
          twilioError.message,
          String(twilioError.code),
        );
      }
      throw new ProviderError(
        this.name,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Sleeps {@link VERIFY_DELAY_MS} then fetches the message to catch
   * async failures (sandbox, blocked, opt-in) that don't throw at send
   * time. Disable via `skipVerify: true` in tests.
   */
  async #verifyDelivery(
    client: TwilioClientLike,
    sid: string,
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, VERIFY_DELAY_MS));
    const msg = await client.messages(sid).fetch();
    if (msg.status === "failed" || msg.status === "undelivered") {
      const description = twilioErrorMessage(
        msg.errorCode,
        msg.errorMessage ?? undefined,
      );
      throw new ProviderError(this.name, description, String(msg.errorCode));
    }
  }
}

/**
 * Narrow structural type — keeps `twilio` out of the build dep graph
 * when the SDK isn't installed.
 */
interface TwilioClientLike {
  messages: {
    create(args: Record<string, unknown>): Promise<{
      sid: string;
      status: string;
    }>;
  } & ((sid: string) => {
    fetch(): Promise<{
      status: string;
      errorCode: number | null;
      errorMessage: string | null;
    }>;
  });
}
