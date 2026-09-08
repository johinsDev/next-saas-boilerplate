/**
 * The party kinds that exist.
 *
 * This list is the contract with `partykit/partykit.json`: a room's kind
 * becomes the party name in the URL (`/parties/<kind>/<body>`), so a kind with
 * no matching party in that file routes to a 404 — silently, because nothing
 * on either side reads the other. `__tests__/party-kinds.test.ts` reads
 * partykit.json and fails when the two drift, which is the only reason the two
 * can be trusted to agree.
 *
 * Adding a party means three edits: this list, `partykit/partykit.json`, and a
 * `src/parties/<kind>.ts` implementation.
 */
export const PARTY_KINDS = ["user", "organization"] as const;

export type PartyKind = (typeof PARTY_KINDS)[number];

/**
 * A single user's private channel. Every device that user has signed in on
 * shares it, so one publish reaches all of them.
 *
 * The body is the Better Auth `user.id` — global, not per-organization. A
 * ticket for one of these rooms must be issued to that same user; see
 * `signTicket`.
 */
export type UserRoom = `user:${string}`;

/** An organization-wide channel: every operator of that org. */
export type OrganizationRoom = `organization:${string}`;

export type RoomName = UserRoom | OrganizationRoom;

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
 * Split out so the kind routes to the matching party class in PartyKit, and
 * the body becomes the room id within it.
 */
export interface ParsedRoom {
  kind: PartyKind;
  body: string;
}

function isPartyKind(value: string): value is PartyKind {
  return (PARTY_KINDS as readonly string[]).includes(value);
}

export function parseRoom(room: RoomName): ParsedRoom {
  const idx = room.indexOf(":");
  if (idx < 0) throw new Error(`invalid room name: ${room}`);
  const kind = room.slice(0, idx);
  const body = room.slice(idx + 1);
  if (!body) throw new Error(`empty room body: ${room}`);
  // Callers reaching this from untyped input (a ticket's `roomId` is a plain
  // string over the wire) would otherwise mint a URL for a party that does not
  // exist and get an opaque 404 at connect time.
  if (!isPartyKind(kind)) {
    throw new Error(
      `unknown party kind "${kind}" (expected one of: ${PARTY_KINDS.join(", ")})`,
    );
  }
  return { kind, body };
}
