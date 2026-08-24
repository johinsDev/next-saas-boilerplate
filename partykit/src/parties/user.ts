import type * as Party from "partykit/server";

import { verifyHmac, verifyTicket } from "./_shared/auth";
import type { RealtimeEvent } from "./_shared/types";

/**
 * Per-user party. One room per `user:<uuid>`. All of a
 * user's connected devices (browser tabs, future Expo app) share
 * the same room — events broadcast once and reach everyone.
 *
 * Server-to-party flow (publishing an event from Next):
 *   1. Service calls `realtime.publish("user:<id>", { event, data })`
 *   2. RealtimeClient HMAC-signs the body and POSTs here
 *   3. `onRequest` verifies HMAC + broadcasts via `room.broadcast`
 *   4. Every connected websocket receives the JSON event
 *
 * Client-to-party flow (opening a connection):
 *   1. Client calls tRPC `realtime.issueTicket` and gets a short-lived JWT
 *   2. Client connects with `?token=<jwt>` query param
 *   3. `onBeforeConnect` verifies the ticket + asserts the room matches
 *   4. On success the connection joins the room; `onConnect` greets it
 *
 * No `onMessage` handler — this party doesn't accept client-pushed
 * events. The card / dashboard reads only. Chat / collaborative use
 * cases live in different party classes (see SKILL.md).
 */
export default class CustomerParty implements Party.Server {
  constructor(readonly room: Party.Room) {}

  static async onBeforeConnect(
    request: Party.Request,
    lobby: Party.Lobby,
  ): Promise<Party.Request | Response> {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) return new Response("missing token", { status: 401 });
    const secret = (lobby.env as Record<string, string | undefined>)
      .REALTIME_AUTH_SECRET;
    if (!secret) {
      return new Response("server missing REALTIME_AUTH_SECRET", {
        status: 500,
      });
    }
    try {
      // The ticket is signed against the full `user:<id>` room name
      // (see RealtimeService.issueTicket). `lobby.id` is just the
      // <id> portion — PartyKit splits the kind off into the URL path.
      // Reconstruct the canonical room name before verifying.
      await verifyTicket(token, secret, `user:${lobby.id}`);
    } catch {
      return new Response("invalid token", { status: 401 });
    }
    return request;
  }

  onConnect(conn: Party.Connection): void {
    const ready: RealtimeEvent = {
      event: "connection.ready",
      data: { roomId: this.room.id },
      emittedAt: new Date().toISOString(),
    };
    conn.send(JSON.stringify(ready));
  }

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }
    const secret = (this.room.env as Record<string, string | undefined>)
      .REALTIME_AUTH_SECRET;
    if (!secret) {
      return new Response("server missing REALTIME_AUTH_SECRET", {
        status: 500,
      });
    }
    const body = await req.text();
    try {
      await verifyHmac(body, req.headers.get("x-realtime-signature"), secret);
    } catch {
      return new Response("invalid signature", { status: 401 });
    }
    let event: RealtimeEvent;
    try {
      const parsed = JSON.parse(body) as Partial<RealtimeEvent>;
      if (!parsed.event || !parsed.data) throw new Error("invalid event");
      event = {
        event: parsed.event,
        data: parsed.data,
        emittedAt: parsed.emittedAt ?? new Date().toISOString(),
      };
    } catch {
      return new Response("invalid body", { status: 400 });
    }
    this.room.broadcast(JSON.stringify(event));
    return new Response("ok");
  }
}
