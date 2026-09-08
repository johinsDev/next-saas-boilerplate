import { SignJWT } from "jose";

import { parseRoom, type RealtimeTicket, type RoomName } from "./types";

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

/**
 * Sign an HS256 ticket the client will hand to PartyKit on connect.
 * The party verifies the same signature with the same secret and
 * confirms the room id matches.
 *
 * - `sub` = the entity authorized for this room
 * - `room` = the room id the ticket grants access to (one ticket = one room)
 * - `exp` = signTime + ttl
 *
 * **A `user:<id>` ticket must be issued to that same user.** The party checks
 * that the ticket names its room, but a ticket naming someone else's room is
 * still validly signed — so without this check any caller that gets a subject
 * and a room from two different places hands out a subscription to a stranger's
 * private channel, and every event published there leaks. Enforced here rather
 * than left to callers because there is no legitimate exception to it.
 *
 * `organization:` rooms cannot be checked here: membership lives in the
 * database and this package has no access to it. Whoever issues those tickets
 * owns that check.
 *
 * Keep `ttlSeconds` short — the client auto-refreshes before expiry
 * via the React hook, so there's no UX cost to a 5-minute TTL.
 */
export async function signTicket(params: {
  subject: string;
  roomId: RoomName;
  secret: string;
  ttlSeconds?: number;
}): Promise<RealtimeTicket> {
  const { subject, roomId, secret, ttlSeconds = DEFAULT_TTL_SECONDS } = params;
  if (!secret) throw new Error("signTicket: secret is required");
  if (!subject) throw new Error("signTicket: subject is required");

  const { kind, body } = parseRoom(roomId);
  if (kind === "user" && body !== subject) {
    throw new Error(
      `signTicket: a user room may only be granted to its own user (room ${roomId}, subject ${subject})`,
    );
  }

  const key = new TextEncoder().encode(secret);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expSeconds = nowSeconds + ttlSeconds;

  const token = await new SignJWT({ room: roomId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expSeconds)
    .sign(key);

  return {
    token,
    expiresAt: new Date(expSeconds * 1000).toISOString(),
    roomId,
  };
}

/**
 * HMAC-SHA256 the request body and return the value for the
 * `X-Realtime-Signature` header. Format: `hmac-sha256=<hex>`.
 *
 * Used by `RealtimeClient.publish` to authenticate to PartyKit when
 * the server (Next / jobs) wants to broadcast an event into a room.
 */
export async function signHmac(body: string, secret: string): Promise<string> {
  if (!secret) throw new Error("signHmac: secret is required");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return `hmac-sha256=${bytesToHex(new Uint8Array(sigBuf))}`;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}
