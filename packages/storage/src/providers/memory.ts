import { FileNotFoundError } from "../errors";
import { signStorageToken, verifyStorageToken } from "../token";
import type { StorageTokenPayload } from "../token";
import type {
  ListOptions,
  PresignedUpload,
  PutOptions,
  PutSignedUrlOptions,
  StorageBody,
  StorageFile,
  StorageListResult,
  StorageProvider,
} from "../types";
import { coerceBody } from "./_shared/body";

export interface MemoryProviderConfig {
  baseUrl: string;
  secret: string;
  /** Optional logical disk name baked into the signed URLs. Defaults to `default`. */
  diskName?: string;
}

interface StoredEntry {
  body: Uint8Array;
  file: StorageFile;
}

/**
 * In-memory `Map<key, StoredEntry>`. The "presigned" upload + download
 * URLs are HMAC-signed JWTs that point at `/api/storage/upload`
 * (PUT) and `/api/storage/serve` (GET) route handlers — those decode
 * the token and call this provider's `put` / `get`.
 *
 * Used by FakeDisk for tests, and as the fallback provider in preview
 * deploys where R2 keys aren't configured.
 */
export class MemoryProvider implements StorageProvider {
  readonly name = "memory";
  readonly #config: MemoryProviderConfig;
  readonly #store = new Map<string, StoredEntry>();

  constructor(config: MemoryProviderConfig) {
    this.#config = config;
  }

  async put(
    key: string,
    body: StorageBody,
    options: PutOptions = {},
  ): Promise<StorageFile> {
    const bytes = await coerceBody(body);
    const file: StorageFile = {
      key,
      size: bytes.byteLength,
      contentType: options.contentType,
      lastModified: new Date(),
      metadata: options.metadata,
    };
    this.#store.set(key, { body: bytes, file });
    return file;
  }

  async putSignedUrl(
    key: string,
    options: PutSignedUrlOptions,
  ): Promise<PresignedUpload> {
    const ttl = options.expiresIn ?? 300;
    const token = await signStorageToken({
      key,
      disk: this.#config.diskName ?? "default",
      mode: "put",
      contentType: options.contentType,
      maxSize: options.maxSize,
      secret: this.#config.secret,
      ttlSeconds: ttl,
    });
    return {
      url: `${this.#config.baseUrl}/api/storage/upload?token=${encodeURIComponent(token.token)}`,
      key,
      method: "PUT",
      headers: { "content-type": options.contentType },
      expiresAt: token.expiresAt,
    };
  }

  async get(key: string): Promise<{ body: Uint8Array; file: StorageFile }> {
    const entry = this.#store.get(key);
    if (!entry) throw new FileNotFoundError(key);
    return { body: entry.body, file: entry.file };
  }

  async getSignedUrl(key: string, expiresIn = 300): Promise<string> {
    const token = await signStorageToken({
      key,
      disk: this.#config.diskName ?? "default",
      mode: "get",
      secret: this.#config.secret,
      ttlSeconds: expiresIn,
    });
    return `${this.#config.baseUrl}/api/storage/serve?token=${encodeURIComponent(token.token)}`;
  }

  getPublicUrl(_key: string): string | null {
    return null;
  }

  async delete(key: string): Promise<void> {
    this.#store.delete(key);
  }

  async list(options: ListOptions = {}): Promise<StorageListResult> {
    const all = [...this.#store.values()].map((e) => e.file);
    const filtered = options.prefix
      ? all.filter((f) => f.key.startsWith(options.prefix!))
      : all;
    filtered.sort((a, b) => a.key.localeCompare(b.key));
    const limit = options.limit ?? 100;
    return { files: filtered.slice(0, limit), cursor: null };
  }

  async head(key: string): Promise<StorageFile | null> {
    return this.#store.get(key)?.file ?? null;
  }

  // Signed-request handlers — the HTTP side of the presigned URLs minted
  // by putSignedUrl/getSignedUrl. The API Worker mounts these at
  // /api/storage/{upload,serve}; they verify the token with this provider's
  // own secret (so signer + verifier can't diverge) and enforce the token's
  // upload constraints before touching the store.

  async handleSignedUpload(request: Request): Promise<Response> {
    const token = new URL(request.url).searchParams.get("token");
    if (!token) return new Response("missing token", { status: 401 });
    let payload: StorageTokenPayload;
    try {
      payload = await verifyStorageToken({
        token,
        secret: this.#config.secret,
        expectedMode: "put",
      });
    } catch {
      return new Response("invalid token", { status: 401 });
    }
    const requestType = request.headers.get("content-type") ?? undefined;
    if (payload.contentType && requestType && requestType !== payload.contentType) {
      return new Response("content-type mismatch", { status: 415 });
    }
    const body = new Uint8Array(await request.arrayBuffer());
    if (payload.maxSize !== undefined && body.byteLength > payload.maxSize) {
      return new Response("file too large", { status: 413 });
    }
    await this.put(payload.key, body, {
      contentType: payload.contentType ?? requestType,
    });
    return new Response(null, { status: 200 });
  }

  async handleSignedServe(request: Request): Promise<Response> {
    const token = new URL(request.url).searchParams.get("token");
    if (!token) return new Response("missing token", { status: 401 });
    let payload: StorageTokenPayload;
    try {
      payload = await verifyStorageToken({
        token,
        secret: this.#config.secret,
        expectedMode: "get",
      });
    } catch {
      return new Response("invalid token", { status: 401 });
    }
    try {
      const { body, file } = await this.get(payload.key);
      // Re-wrap so the body is `Uint8Array<ArrayBuffer>` (not the TS 5.7
      // `<ArrayBufferLike>` generic, which `BodyInit` rejects under the DOM
      // lib). Same fix as r2-fetch's PUT body.
      return new Response(new Uint8Array(body), {
        status: 200,
        ...(file.contentType && {
          headers: { "content-type": file.contentType },
        }),
      });
    } catch (err) {
      if (err instanceof FileNotFoundError) {
        return new Response("not found", { status: 404 });
      }
      throw err;
    }
  }

  // Test helpers

  keys(): string[] {
    return [...this.#store.keys()];
  }

  clear(): void {
    this.#store.clear();
  }
}
