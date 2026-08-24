/**
 * The party kinds that exist today (or are documented as stubs in the
 * `realtime` skill). Adding a new party = extend this union AND add a
 * `verifyXxxAccess()` rule in the tRPC ticket service.
 */
export type CustomerRoom = `customer:${string}`;
export type OrgRoom = `org:${string}`;
export type ChatRoom = `chat:${string}`;

export type RoomName = CustomerRoom | OrgRoom | ChatRoom;

/**
 * Wire shape every event published into a party uses. Producers fill
 * in `event` + `data`; the publisher sets `emittedAt`. Mirrors the
 * shape in `partykit/src/parties/_shared/types.ts` — keep both in sync.
 */
export interface RealtimeEvent {
  event: string;
  data: Record<string, unknown>;
  emittedAt: string;
}

/**
 * What `realtime.issueTicket` returns. The client passes `token` as a
 * query param when opening the WebSocket; `expiresAt` lets the hook
 * pre-refresh before the JWT lapses (TTL is 5 minutes by default).
 */
export interface RealtimeTicket {
  token: string;
  expiresAt: string;
  roomId: string;
}

/**
 * Split out so the kind ("customer" / "org" / "chat") routes to the
 * matching party class in PartyKit. The body ("c_xxx") is the room id.
 */
export interface ParsedRoom {
  kind: "customer" | "org" | "chat";
  body: string;
}

export function parseRoom(room: RoomName): ParsedRoom {
  const idx = room.indexOf(":");
  if (idx < 0) throw new Error(`invalid room name: ${room}`);
  const kind = room.slice(0, idx) as ParsedRoom["kind"];
  const body = room.slice(idx + 1);
  if (!body) throw new Error(`empty room body: ${room}`);
  return { kind, body };
}
