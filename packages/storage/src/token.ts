import { SignJWT, jwtVerify } from "jose";

import { InvalidTokenError } from "./errors";

const DEFAULT_TTL_SECONDS = 300;

export interface StorageTokenPayload {
  /** Object key the token grants access to. */
  key: string;
  /** Disk the key lives in. */
  disk: string;
  /** "put" = upload, "get" = download. */
  mode: "put" | "get";
  /** Required content type on PUT (server enforces). */
  contentType?: string;
  /** Max body size in bytes on PUT (server enforces). */
  maxSize?: number;
  /** Unix seconds. */
  exp: number;
  /** Unix seconds. */
  iat: number;
}

export interface SignedToken {
  token: string;
  expiresAt: string;
}

/**
 * HS256-sign a storage token. Carries `key`, `disk`, `mode`, and the
 * optional upload constraints (`contentType`, `maxSize`). The route
 * handlers at `/api/storage/upload` and `/api/storage/serve` verify
 * this with the same secret + enforce the constraints before reading
 * or writing.
 *
 * Same crypto primitive as `@saas/realtime`'s ticket flow — both
 * channels share the `REALTIME_AUTH_SECRET` env var so apps don't
 * manage two secrets. The storage feature uses different `mode` values
 * + asserts on them to stay isolated from the realtime tokens.
 */
export async function signStorageToken(params: {
  key: string;
  disk: string;
  mode: "put" | "get";
  secret: string;
  contentType?: string;
  maxSize?: number;
  ttlSeconds?: number;
}): Promise<SignedToken> {
  const {
    key,
    disk,
    mode,
    secret,
    contentType,
    maxSize,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  } = params;
  if (!secret) throw new Error("signStorageToken: secret is required");

  const keyBytes = new TextEncoder().encode(secret);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;

  const token = await new SignJWT({
    key,
    disk,
    mode,
    ...(contentType && { contentType }),
    ...(maxSize !== undefined && { maxSize }),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(keyBytes);

  return {
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/**
 * Verify + decode a storage token. Throws `InvalidTokenError` on bad
 * signature, expired token, or `mode` mismatch.
 */
export async function verifyStorageToken(params: {
  token: string;
  secret: string;
  expectedMode: "put" | "get";
}): Promise<StorageTokenPayload> {
  const { token, secret, expectedMode } = params;
  const keyBytes = new TextEncoder().encode(secret);
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, keyBytes, { algorithms: ["HS256"] });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    throw new InvalidTokenError(
      err instanceof Error ? err.message : "verification failed",
    );
  }
  if (payload.mode !== expectedMode) {
    throw new InvalidTokenError(
      `expected mode "${expectedMode}", got "${String(payload.mode)}"`,
    );
  }
  if (typeof payload.key !== "string" || typeof payload.disk !== "string") {
    throw new InvalidTokenError("token missing key/disk");
  }
  return {
    key: payload.key,
    disk: payload.disk,
    mode: expectedMode,
    contentType: typeof payload.contentType === "string" ? payload.contentType : undefined,
    maxSize: typeof payload.maxSize === "number" ? payload.maxSize : undefined,
    exp: payload.exp as number,
    iat: payload.iat as number,
  };
}
