import { signHmac } from "./ticket";
import { parseRoom, type RealtimeEvent, type RoomName } from "./types";

export interface RealtimeClientConfig {
  /** PartyKit host: `<project>.<user>.partykit.dev` or a custom CNAME. */
  host: string;
  /** Project name from `partykit.json` (matches the deployed worker). */
  project: string;
  /** HS256 secret shared with the PartyKit server. */
  secret: string;
  /** Defaults to `https`. Use `http` for local dev. */
  protocol?: "http" | "https";
  /**
   * Optional prefix prepended to the room *body* (the id after the
   * kind), so multiple environments can share one deployed party
   * without colliding. Previews set `pr-<n>-` (per-PR isolation);
   * prod/local leave it empty. The ticket service applies the same
   * prefix so the JWT room claim matches what we publish to.
   */
  roomPrefix?: string;
}

/**
 * Server-side publisher. Called from Next route handlers, tRPC
 * mutations, and Trigger.dev tasks to broadcast events into a room.
 *
 * Wire flow:
 *   1. Serialize the event to JSON
 *   2. HMAC-sign the body with the shared secret
 *   3. POST to `https://<host>/parties/<kind>/<body>` with the
 *      `X-Realtime-Signature` header
 *   4. PartyKit's `onRequest` verifies, broadcasts to all open
 *      WebSocket connections in the room, and returns 200
 *
 * Errors:
 *   - Network failures throw (so callers can decide to log + retry)
 *   - HTTP non-2xx throws with the response body
 *   - Empty rooms (no listeners) still return 200 — broadcast is
 *     best-effort fire-and-forget
 */
export class RealtimeClient {
  readonly name = "partykit";
  readonly #config: RealtimeClientConfig;

  constructor(config: RealtimeClientConfig) {
    this.#config = config;
  }

  async publish(
    room: RoomName,
    event: Omit<RealtimeEvent, "emittedAt">,
  ): Promise<void> {
    const { kind, body: rawBody } = parseRoom(room);
    const roomBody = `${this.#config.roomPrefix ?? ""}${rawBody}`;
    const protocol = this.#config.protocol ?? "https";
    const url = `${protocol}://${this.#config.host}/parties/${kind}/${roomBody}`;
    const payload: RealtimeEvent = {
      event: event.event,
      data: event.data,
      emittedAt: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);
    const signature = await signHmac(body, this.#config.secret);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-realtime-signature": signature,
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "<no body>");
      throw new Error(
        `realtime publish failed (${res.status}): ${text.slice(0, 200)}`,
      );
    }
  }
}
