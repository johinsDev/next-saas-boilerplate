/**
 * One row in a listing. `size` is bytes; `lastModified` is `null` if
 * the provider doesn't track it (memory does, filesystem does, R2 does).
 */
export interface StorageFile {
  key: string;
  size: number;
  contentType?: string;
  lastModified: Date | null;
  metadata?: Record<string, string>;
}

/**
 * What you get back from `disk.list(...)`. Cursor is for pagination
 * (R2 supports it; memory + local just return `null`).
 */
export interface StorageListResult {
  files: StorageFile[];
  cursor: string | null;
}

/**
 * Body shape accepted by `disk.put(...)`. We deliberately keep it
 * broad — providers normalize internally.
 */
export type StorageBody =
  | Buffer
  | Uint8Array
  | ArrayBuffer
  | Blob
  | string
  | ReadableStream<Uint8Array>;

export interface PutOptions {
  contentType?: string;
  /** Free-form key/value pairs the provider stores alongside the file. */
  metadata?: Record<string, string>;
}

export interface PutSignedUrlOptions {
  contentType: string;
  /** Bytes. Enforced on the server-side route handler for local/memory. */
  maxSize?: number;
  /** Seconds the URL stays valid. Defaults to 5 minutes. */
  expiresIn?: number;
  metadata?: Record<string, string>;
}

/**
 * Compact return type for `disk.putSignedUrl(...)`. The client uses
 * these to upload directly to storage (PUT) — Vercel functions never
 * see the bytes when the provider is `r2`.
 */
export interface PresignedUpload {
  url: string;
  key: string;
  /** When non-empty, the client must echo these on the PUT (e.g. `Content-Type` for R2). */
  headers?: Record<string, string>;
  method: "PUT";
  expiresAt: string;
}

export interface ListOptions {
  prefix?: string;
  cursor?: string;
  /** Max items per page. Defaults to 100. */
  limit?: number;
}

/**
 * Provider contract. Every backend (memory / local / r2 / future) must
 * implement these.
 *
 * Splitting "put" + "putSignedUrl" lets the route handler write
 * directly (local/memory) while production paths only mint URLs.
 */
export interface StorageProvider {
  readonly name: string;

  put(key: string, body: StorageBody, options?: PutOptions): Promise<StorageFile>;
  putSignedUrl(key: string, options: PutSignedUrlOptions): Promise<PresignedUpload>;

  get(key: string): Promise<{ body: Uint8Array; file: StorageFile }>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  getPublicUrl(key: string): string | null;

  delete(key: string): Promise<void>;
  list(options?: ListOptions): Promise<StorageListResult>;
  head(key: string): Promise<StorageFile | null>;

  /**
   * Serve the HTTP side of the presigned URLs (the PUT upload / GET serve
   * routes the API Worker mounts at `/api/storage/*`). Only the providers
   * whose signed URLs point back at the app implement these — `memory`
   * (and `local`); `r2` presigns straight to the bucket, so it omits them
   * and the disk/manager returns 404 for that route.
   */
  handleSignedUpload?(request: Request): Promise<Response>;
  handleSignedServe?(request: Request): Promise<Response>;
}

/**
 * Structural slice of `@saas/log`'s `Logger`. Kept narrow so swapping
 * loggers (or fakes) doesn't drag the whole package surface.
 */
export interface StorageLogger {
  info(bindings: Record<string, unknown>, msg?: string): void;
  warn(bindings: Record<string, unknown>, msg?: string): void;
  error(bindings: Record<string, unknown>, msg?: string): void;
}

export interface MemoryDiskConfig {
  provider: "memory";
  /** Public base URL for signed-URL targets (`/api/storage/upload`). */
  baseUrl: string;
  /** HMAC secret for signing/verifying tokens. */
  secret: string;
  /** When true, `getDownloadUrl` returns the public path without signing. */
  isPublic?: boolean;
}

export interface LocalDiskConfig {
  provider: "local";
  /** Defaults to `<cwd>/.storage`. */
  rootDir?: string;
  /** Public base URL for signed-URL targets. */
  baseUrl: string;
  /** HMAC secret for signing/verifying tokens. */
  secret: string;
  isPublic?: boolean;
}

export interface R2DiskConfig {
  provider: "r2";
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Cloudflare's `pub-<hash>.r2.dev` or a custom CNAME. Only needed when `isPublic: true`. */
  publicUrl?: string;
  isPublic?: boolean;
  /**
   * Which R2 implementation to use. `fetch` = aws4fetch, Workers-safe
   * (Cloudflare Workers / `workerd`). Default `aws-sdk` for Node.
   */
  driver?: "aws-sdk" | "fetch";
}

export type DiskConfig = MemoryDiskConfig | LocalDiskConfig | R2DiskConfig;

export type StorageLogLevel = "debug" | "info" | "silent";

export interface StorageManagerConfig<
  T extends Record<string, DiskConfig | undefined>,
> {
  default: keyof T & string;
  disks: T;
  /**
   * Prepended to every key on every disk (callers keep using logical keys).
   * Use it to namespace a deploy — e.g. `pr-123/` in preview so each PR's
   * uploads live in their own folder and can be purged on PR close. Empty
   * (default) = no-op.
   */
  keyPrefix?: string;
  /** Defaults to `info`. `silent` suppresses internal `[storage]` lines. */
  logLevel?: StorageLogLevel;
}
