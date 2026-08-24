import type * as Party from "partykit/server";

import { verifyHmac, verifyTicket } from "./_shared/auth";
import type { RealtimeEvent } from "./_shared/types";

/**
 * Per-organization party. One room per `organization:<orgId>`, shared by every
 * operator (owner, managers, cashiers) with the admin app open.
 *
 * What travels here is deliberately thin. Admin alerts are fanned out per
 * recipient in the database, and who may see one is enforced row-by-row in
 * SQL — but everyone in the shop shares this room. So the alert signal
 * carries only `{ type, severity }`: enough for a client to refetch its own
 * inbox, never enough to leak the contents of an alert to someone it wasn't
 * addressed to. Do not add titles or bodies to events broadcast here.
 *
 * Flows mirror the user party: HMAC-signed POSTs in from the server,
 * ticket-authenticated WebSockets in from the browser. No `onMessage` —
 * operators read, they don't push.
 */
export default class OrgParty implements Party.Server {
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
      // The ticket is signed against the full `organization:<id>` room name (see
      // RealtimeService.issueTicket). `lobby.id` is only the <id> portion —
      // PartyKit splits the kind off into the URL path — so rebuild the
      // canonical name before verifying. The ticket's `sub` is the operator's
      // user id, and the API only mints one for staff of THIS organization.
      await verifyTicket(token, secret, `organization:${lobby.id}`);
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
