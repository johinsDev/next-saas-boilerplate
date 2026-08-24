import type {
  ListOptions,
  PresignedUpload,
  PutOptions,
  PutSignedUrlOptions,
  StorageBody,
  StorageFile,
  StorageListResult,
  StorageLogLevel,
  StorageLogger,
  StorageProvider,
} from "./types";

export interface StorageDiskOptions {
  name: string;
  provider: StorageProvider;
  /** When true, `getDownloadUrl` returns the public URL (no expiry) instead of a signed one. */
  isPublic?: boolean;
  /**
   * Prepended to every key before it reaches the provider (and stripped back
   * off on the way out). Lets one bucket be namespaced — e.g. a per-PR
   * preview folder `pr-123/` so previews don't collide and can be purged by
   * prefix on PR close. Empty (default) = no-op: keys pass through unchanged.
   */
  keyPrefix?: string;
  logger?: StorageLogger;
  logLevel?: StorageLogLevel;
}

/**
 * One logical bucket. Wraps a `StorageProvider` and adds:
 *
 *   - `getDownloadUrl(key)` — picks public vs signed based on the disk's
 *     `isPublic` flag, so call sites don't need to branch.
 *   - An optional `keyPrefix` that namespaces every key (callers always use
 *     logical keys; the prefix is an internal detail).
 *   - Structured logging on every op (via `@saas/log`-style logger).
 *
 * Created by `StorageManager.disk(name)` and cached per name.
 */
export class StorageDisk {
  readonly name: string;
  readonly provider: StorageProvider;
  readonly isPublic: boolean;
  readonly keyPrefix: string;
  readonly #logger?: StorageLogger;
  readonly #logLevel: StorageLogLevel;

  constructor(options: StorageDiskOptions) {
    this.name = options.name;
    this.provider = options.provider;
    this.isPublic = options.isPublic ?? false;
    this.keyPrefix = options.keyPrefix ?? "";
    this.#logger = options.logger;
    this.#logLevel = options.logLevel ?? "info";
  }

  /** logical key → physical (prefixed) key sent to the provider. */
  #physical(key: string): string {
    return this.keyPrefix + key;
  }

  /** physical (prefixed) key from the provider → logical key for callers. */
  #logical(key: string): string {
    return this.keyPrefix && key.startsWith(this.keyPrefix)
      ? key.slice(this.keyPrefix.length)
      : key;
  }

  async put(
    key: string,
    body: StorageBody,
    options: PutOptions = {},
  ): Promise<StorageFile> {
    this.#log("info", { key, op: "put", contentType: options.contentType });
    const file = await this.provider.put(this.#physical(key), body, options);
    return { ...file, key: this.#logical(file.key) };
  }

  async putSignedUrl(
    key: string,
    options: PutSignedUrlOptions,
  ): Promise<PresignedUpload> {
    this.#log("info", { key, op: "putSignedUrl", contentType: options.contentType });
    const upload = await this.provider.putSignedUrl(this.#physical(key), options);
    return { ...upload, key: this.#logical(upload.key) };
  }

  async get(key: string): Promise<{ body: Uint8Array; file: StorageFile }> {
    this.#log("info", { key, op: "get" });
    const { body, file } = await this.provider.get(this.#physical(key));
    return { body, file: { ...file, key: this.#logical(file.key) } };
  }

  /**
   * Returns the URL the browser should hit to read the file. Picks
   * the public URL when the disk is public; otherwise mints a signed
   * one with the requested TTL (defaults to 5 minutes).
   */
  async getDownloadUrl(key: string, expiresIn?: number): Promise<string> {
    if (this.isPublic) {
      const url = this.provider.getPublicUrl(this.#physical(key));
      if (!url) {
        throw new Error(
          `disk "${this.name}" is marked public but provider "${this.provider.name}" returned no public URL — set publicUrl on the disk config`,
        );
      }
      return url;
    }
    return this.provider.getSignedUrl(this.#physical(key), expiresIn ?? 300);
  }

  /**
   * Always mint a SIGNED read URL, even when the disk is public. Cloudflare
   * image resizing (`cf.image`) can't read our R2 objects through the public
   * custom domain (the resizing fetch gets a 403 — same-zone), but it CAN read
   * a signed S3 URL on `*.r2.cloudflarestorage.com`. The image Worker signs the
   * source with this. Defaults to a 5-minute TTL.
   */
  async signedReadUrl(key: string, expiresIn?: number): Promise<string> {
    return this.provider.getSignedUrl(this.#physical(key), expiresIn ?? 300);
  }

  async delete(key: string): Promise<void> {
    this.#log("info", { key, op: "delete" });
    return this.provider.delete(this.#physical(key));
  }

  async list(options: ListOptions = {}): Promise<StorageListResult> {
    const result = await this.provider.list({
      ...options,
      prefix: this.#physical(options.prefix ?? ""),
    });
    return {
      ...result,
      files: result.files.map((f) => ({ ...f, key: this.#logical(f.key) })),
    };
  }

  async head(key: string): Promise<StorageFile | null> {
    const file = await this.provider.head(this.#physical(key));
    return file ? { ...file, key: this.#logical(file.key) } : null;
  }

  /**
   * Delegate a signed upload/serve HTTP request to the provider. The token
   * already carries the physical (prefixed) key, so we don't re-prefix.
   * Providers that presign straight to their backend (r2) don't implement
   * these — that route is then a 404.
   */
  handleSignedUpload(request: Request): Promise<Response> {
    if (!this.provider.handleSignedUpload) {
      return Promise.resolve(new Response("not found", { status: 404 }));
    }
    return this.provider.handleSignedUpload(request);
  }

  handleSignedServe(request: Request): Promise<Response> {
    if (!this.provider.handleSignedServe) {
      return Promise.resolve(new Response("not found", { status: 404 }));
    }
    return this.provider.handleSignedServe(request);
  }

  #log(
    level: "info" | "warn",
    bindings: Record<string, unknown>,
    msg?: string,
  ): void {
    if (this.#logLevel === "silent") return;
    if (this.#logger) {
      const fn = level === "warn" ? this.#logger.warn : this.#logger.info;
      fn.call(
        this.#logger,
        { ...bindings, _service: "storage", disk: this.name, provider: this.provider.name },
        msg ?? "storage.op",
      );
      return;
    }
    // eslint-disable-next-line no-console
    console.log("[storage]", msg ?? "op", { disk: this.name, ...bindings });
  }
}
