import { promises as fs } from "node:fs";
import path from "node:path";

import { FileNotFoundError, ProviderError } from "../errors";
import { signStorageToken } from "../token";
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

const META_SUFFIX = ".__meta__.json";

export interface LocalProviderConfig {
  rootDir?: string;
  baseUrl: string;
  secret: string;
  diskName?: string;
}

interface StoredMetadata {
  contentType?: string;
  metadata?: Record<string, string>;
  size: number;
  lastModified: string;
}

/**
 * Filesystem provider. Writes `<rootDir>/<key>` for the body and a
 * sibling `<key>.__meta__.json` for content-type + custom metadata.
 *
 * Same HMAC-signed URL pattern as memory: `putSignedUrl` returns a
 * URL pointing at `/api/storage/upload` that the route handler verifies
 * before calling `put()` on this provider.
 *
 * Use case: local dev — survives `next dev` restarts because the
 * bytes are on disk. NOT viable on Vercel (function instances are
 * ephemeral) — fall back to memory or R2 there.
 */
export class LocalProvider implements StorageProvider {
  readonly name = "local";
  readonly #config: LocalProviderConfig;
  readonly #rootDir: string;

  constructor(config: LocalProviderConfig) {
    this.#config = config;
    this.#rootDir = path.resolve(config.rootDir ?? ".storage");
  }

  async put(
    key: string,
    body: StorageBody,
    options: PutOptions = {},
  ): Promise<StorageFile> {
    const bytes = await coerceBody(body);
    const filePath = this.#filePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, bytes);
    const meta: StoredMetadata = {
      contentType: options.contentType,
      metadata: options.metadata,
      size: bytes.byteLength,
      lastModified: new Date().toISOString(),
    };
    await fs.writeFile(`${filePath}${META_SUFFIX}`, JSON.stringify(meta));
    return {
      key,
      size: bytes.byteLength,
      contentType: options.contentType,
      lastModified: new Date(meta.lastModified),
      metadata: options.metadata,
    };
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
    const filePath = this.#filePath(key);
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(filePath);
    } catch (err) {
      if (isFsNotFound(err)) throw new FileNotFoundError(key);
      throw new ProviderError(this.name, "read failed", undefined, err);
    }
    const meta = await this.#readMeta(filePath);
    return {
      body: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      file: {
        key,
        size: bytes.byteLength,
        contentType: meta?.contentType,
        lastModified: meta ? new Date(meta.lastModified) : null,
        metadata: meta?.metadata,
      },
    };
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
    const filePath = this.#filePath(key);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (!isFsNotFound(err)) {
        throw new ProviderError(this.name, "delete failed", undefined, err);
      }
    }
    try {
      await fs.unlink(`${filePath}${META_SUFFIX}`);
    } catch {
      /* ignore */
    }
  }

  async list(options: ListOptions = {}): Promise<StorageListResult> {
    const all: StorageFile[] = [];
    try {
      await this.#walk(this.#rootDir, async (filePath) => {
        if (filePath.endsWith(META_SUFFIX)) return;
        const key = path.relative(this.#rootDir, filePath).split(path.sep).join("/");
        if (options.prefix && !key.startsWith(options.prefix)) return;
        const stat = await fs.stat(filePath);
        const meta = await this.#readMeta(filePath);
        all.push({
          key,
          size: stat.size,
          contentType: meta?.contentType,
          lastModified: meta ? new Date(meta.lastModified) : stat.mtime,
          metadata: meta?.metadata,
        });
      });
    } catch (err) {
      if (!isFsNotFound(err)) {
        throw new ProviderError(this.name, "list failed", undefined, err);
      }
    }
    all.sort((a, b) => a.key.localeCompare(b.key));
    const limit = options.limit ?? 100;
    return { files: all.slice(0, limit), cursor: null };
  }

  async head(key: string): Promise<StorageFile | null> {
    const filePath = this.#filePath(key);
    try {
      const stat = await fs.stat(filePath);
      const meta = await this.#readMeta(filePath);
      return {
        key,
        size: stat.size,
        contentType: meta?.contentType,
        lastModified: meta ? new Date(meta.lastModified) : stat.mtime,
        metadata: meta?.metadata,
      };
    } catch (err) {
      if (isFsNotFound(err)) return null;
      throw new ProviderError(this.name, "head failed", undefined, err);
    }
  }

  // ─── internals ───────────────────────────────────────────────

  #filePath(key: string): string {
    // Guard against absolute paths / traversal — `keySchema` already
    // forbids these, but belt-and-suspenders here too.
    if (path.isAbsolute(key) || key.includes("..")) {
      throw new ProviderError(this.name, "invalid key (traversal)");
    }
    return path.join(this.#rootDir, key);
  }

  async #readMeta(filePath: string): Promise<StoredMetadata | null> {
    try {
      const raw = await fs.readFile(`${filePath}${META_SUFFIX}`, "utf8");
      return JSON.parse(raw) as StoredMetadata;
    } catch {
      return null;
    }
  }

  async #walk(
    dir: string,
    visit: (filePath: string) => Promise<void>,
  ): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // eslint-disable-next-line no-await-in-loop
        await this.#walk(fullPath, visit);
      } else if (entry.isFile()) {
        // eslint-disable-next-line no-await-in-loop
        await visit(fullPath);
      }
    }
  }
}

function isFsNotFound(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as { code: string }).code === "ENOENT"
  );
}
