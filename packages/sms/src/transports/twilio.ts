import { ProviderError, RateLimitError } from "../errors";
import { smsSegmentInfo } from "../schemas";
import type {
  SmsMessageData,
  SmsResponse,
  SmsTransport,
  TwilioSmsProviderConfig,
} from "../types";
import { dynamicImport } from "./_lazy";

const VERIFY_DELAY_MS = 2_000;

/**
 * Maps the most common Twilio SMS error codes to operator-friendly
 * messages. Reference: https://www.twilio.com/docs/api/errors
 */
function twilioErrorMessage(code: number | null, fallback?: string): string {
  if (code === 21211) return "Invalid 'to' phone number.";
  if (code === 21408) return "Permission to send SMS to this country denied.";
  if (code === 21610) return "Recipient unsubscribed (STOP).";
  if (code === 21612) return "Carrier rejected — number unreachable.";
  if (code === 30003) return "Handset unreachable / powered off.";
  if (code === 30004) return "Message blocked by recipient carrier.";
  if (code === 30005) return "Unknown destination handset.";
  if (code === 30006) return "Landline or unreachable carrier.";
  if (code === 30007) return "Carrier flagged message as spam.";
  return fallback ?? "Twilio delivery failed.";
}

/**
 * Production transport. Sends via Twilio's Messages API.
 *
 * Lazy-loads the `twilio` SDK on first send so the package can be
 * imported (e.g. by tests using the log/outbox transports) without
 * twilio installed.
 */
export class TwilioTransport implements SmsTransport {
  readonly name = "twilio";
  readonly #config: TwilioSmsProviderConfig;
  #client: unknown;

  constructor(config: TwilioSmsProviderConfig) {
    this.#config = config;
  }

  async #getClient(): Promise<TwilioClientLike> {
    if (!this.#client) {
      // `twilio` is an optional peer dep. Function-constructor
      // indirection in `_lazy.ts` keeps the bundler from tracing it.
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

  async send(message: SmsMessageData): Promise<SmsResponse> {
    const client = await this.#getClient();
    const from = message.from ?? this.#config.from;
    const seg = smsSegmentInfo(message.content);

    try {
      const result = await client.messages.create({
        to: message.to,
        from,
        body: message.content,
      });

      if (!this.#config.skipVerify) {
        await this.#verifyDelivery(client, result.sid);
      }

      return {
        status: result.status === "queued" ? "queued" : "sent",
        providerMessageId: result.sid,
        provider: this.name,
        timestamp: new Date().toISOString(),
        segments: {
          encoding: seg.encoding,
          characters: seg.characters,
          count: seg.segments,
        },
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
   * async failures (carrier rejection, unreachable handset) that don't
   * throw at send time. Disable via `skipVerify: true` in tests.
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
