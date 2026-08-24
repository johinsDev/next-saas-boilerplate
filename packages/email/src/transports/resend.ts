import {
  MissingDependencyError,
  ProviderError,
  RateLimitError,
} from "../errors";
import { priorityToXPriority } from "../schemas";
import { dynamicImport } from "./_lazy";
import type {
  EmailMessageData,
  EmailResponse,
  EmailTransport,
  Recipient,
  ResendProviderConfig,
} from "../types";

function recipientLabel(r: Recipient): string {
  if (typeof r === "string") return r;
  return r.name ? `${r.name} <${r.address}>` : r.address;
}

function asMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Production transport. Sends via Resend's HTTP API.
 *
 * Lazy-loads the `resend` SDK on first send so the package can be
 * imported (e.g. by tests using the log/outbox transports) without
 * `resend` installed. Throws a clear `MissingDependencyError` if you
 * select this provider without `bun add resend`.
 *
 * Maps:
 *   - 429 statusCode → `RateLimitError(60_000)`
 *   - Other errors → `ProviderError(provider, message, code, cause)`
 *   - Priority → `X-Priority` header (1/3/5)
 */
export class ResendTransport implements EmailTransport {
  readonly name = "resend";
  readonly #config: ResendProviderConfig;
  #client: unknown;

  constructor(config: ResendProviderConfig) {
    this.#config = config;
  }

  async #getClient(): Promise<ResendClientLike> {
    if (this.#client) return this.#client as ResendClientLike;
    let mod: { Resend: new (apiKey: string) => ResendClientLike };
    try {
      mod = (await dynamicImport("resend")) as unknown as typeof mod;
    } catch {
      throw new MissingDependencyError("resend", "resend");
    }
    this.#client = new mod.Resend(this.#config.apiKey);
    return this.#client as ResendClientLike;
  }

  async send(message: EmailMessageData): Promise<EmailResponse> {
    const client = await this.#getClient();

    const from = message.from
      ? recipientLabel(message.from)
      : this.#config.from
        ? recipientLabel(this.#config.from)
        : undefined;
    if (!from) {
      throw new ProviderError(
        this.name,
        "`from` is required — set it on the message or on the provider config",
      );
    }

    const headers: Record<string, string> = { ...message.headers };
    if (message.priority) {
      headers["X-Priority"] = priorityToXPriority(message.priority);
    }

    const payload: Record<string, unknown> = {
      from,
      to: message.to.map(recipientLabel),
      subject: message.subject,
    };
    if (message.html) payload.html = message.html;
    if (message.text) payload.text = message.text;
    if (message.replyTo) payload.reply_to = recipientLabel(message.replyTo);
    if (message.cc?.length) payload.cc = message.cc.map(recipientLabel);
    if (message.bcc?.length) payload.bcc = message.bcc.map(recipientLabel);
    if (message.tags?.length) payload.tags = message.tags;
    if (message.attachments?.length) payload.attachments = message.attachments;
    if (Object.keys(headers).length > 0) payload.headers = headers;

    try {
      const result = await client.emails.send(payload);
      if (result?.error) {
        throw new ProviderError(
          this.name,
          result.error.message ?? "Resend send failed",
          result.error.name,
        );
      }
      return {
        status: "sent",
        providerMessageId: result?.data?.id,
        provider: this.name,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      if (error instanceof ProviderError || error instanceof RateLimitError) {
        throw error;
      }
      if (error && typeof error === "object" && "statusCode" in error) {
        const resendError = error as {
          statusCode: number;
          message: string;
          name?: string;
        };
        if (resendError.statusCode === 429) throw new RateLimitError(60_000);
        throw new ProviderError(
          this.name,
          resendError.message,
          resendError.name,
          error,
        );
      }
      throw new ProviderError(this.name, asMessage(error), undefined, error);
    }
  }
}

/**
 * Narrow structural type — keeps `resend` out of the build dep graph
 * when the SDK isn't installed.
 */
interface ResendClientLike {
  emails: {
    send(payload: Record<string, unknown>): Promise<{
      data?: { id?: string } | null;
      error?: { message?: string; name?: string } | null;
    }>;
  };
}
