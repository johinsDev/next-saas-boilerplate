import { jwtVerify } from "jose";

/**
 * HS256 ticket verification. Used by the PartyKit server to gate
 * WebSocket connections. We export it from `@saas/realtime` so
 * there's a single source of truth for the ticket format, and the
 * PartyKit project pulls it via workspace.
 *
 * Returns the user id (the JWT subject) on success; throws on
 * any failure (bad signature, room mismatch, expired, malformed).
 */
export async function verifyTicket(
  token: string,
  secret: string,
  expectedRoom: string,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
  if (payload.room !== expectedRoom) {
    throw new Error(
      `ticket room mismatch (expected ${expectedRoom}, got ${String(payload.room)})`,
    );
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("ticket missing subject (user id)");
  }
  // A `user:<id>` room is that user's private channel, so the ticket has to
  // name them. Matching the room alone is not enough: a ticket minted with
  // someone else's subject is still validly signed, and accepting it would
  // subscribe the bearer to a stranger's events. `@saas/realtime`'s
  // `signTicket` refuses to mint one; this is the half that refuses to accept
  // one, so a caller that bypasses signTicket still cannot get in.
  const USER_PREFIX = "user:";
  if (expectedRoom.startsWith(USER_PREFIX)) {
    const roomUserId = expectedRoom.slice(USER_PREFIX.length);
    if (payload.sub !== roomUserId) {
      throw new Error("ticket subject does not own this user room");
    }
  }
  return payload.sub;
}

/**
 * HMAC verification — verifies a request body matches the
 * `X-Realtime-Signature` header value. Used by the PartyKit server
 * to gate server-to-party broadcasts.
 */
export async function verifyHmac(
  body: string,
  signatureHeader: string | null,
  secret: string,
): Promise<void> {
  if (!signatureHeader) throw new Error("missing X-Realtime-Signature");
  const prefix = "hmac-sha256=";
  if (!signatureHeader.startsWith(prefix)) {
    throw new Error("invalid signature scheme");
  }
  const expectedBuffer = hexToArrayBuffer(signatureHeader.slice(prefix.length));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    expectedBuffer,
    new TextEncoder().encode(body),
  );
  if (!ok) throw new Error("hmac mismatch");
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  if (hex.length % 2 !== 0) throw new Error("invalid hex length");
  const buffer = new ArrayBuffer(hex.length / 2);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error("invalid hex");
    view[i] = byte;
  }
  return buffer;
}
