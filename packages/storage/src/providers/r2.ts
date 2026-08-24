import {
  FileNotFoundError,
  MissingDependencyError,
  ProviderError,
} from "../errors";
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
import { dynamicImport } from "./_lazy";

export interface R2ProviderConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl?: string;
}

/**
 * Cloudflare R2 (S3-compatible) provider. Lazy-imports the AWS SDK
 * the first time it's needed — keeps the package importable in
 * environments where R2 isn't configured (tests, the `local` /
 * `memory` paths in production-by-mistake).
 *
 * Presigned PUT + GET URLs are minted via `@aws-sdk/s3-request-presigner`;
 * the client uploads directly to R2, bypassing Vercel functions
 * entirely. That's the whole point of this provider — no bandwidth
 * tax, no Vercel function timeout on big files.
 *
 * Maps HTTP statuses:
 *   - 404 / NoSuchKey → `FileNotFoundError`
 *   - other → `ProviderError`
 *
 * Bucket must exist + have an API token with R/W access scoped to it.
 * See `.claude/skills/storage/SKILL.md` for the Cloudflare setup
 * walkthrough.
 */
export class R2Provider implements StorageProvider {
  readonly name = "r2";
  readonly #config: R2ProviderConfig;
  #client: S3ClientLike | undefined;
  #presigner:
    | ((client: S3ClientLike, command: unknown, options?: { expiresIn?: number }) => Promise<string>)
    | undefined;
  #commands:
    | {
        PutObjectCommand: new (input: Record<string, unknown>) => unknown;
        GetObjectCommand: new (input: Record<string, unknown>) => unknown;
        HeadObjectCommand: new (input: Record<string, unknown>) => unknown;
        DeleteObjectCommand: new (input: Record<string, unknown>) => unknown;
        ListObjectsV2Command: new (input: Record<string, unknown>) => unknown;
      }
    | undefined;

  constructor(config: R2ProviderConfig) {
    this.#config = config;
  }

  async #ensure(): Promise<void> {
    if (this.#client) return;
    let s3Module: {
      S3Client: new (config: Record<string, unknown>) => S3ClientLike;
      PutObjectCommand: new (input: Record<string, unknown>) => unknown;
      GetObjectCommand: new (input: Record<string, unknown>) => unknown;
      HeadObjectCommand: new (input: Record<string, unknown>) => unknown;
      DeleteObjectCommand: new (input: Record<string, unknown>) => unknown;
      ListObjectsV2Command: new (input: Record<string, unknown>) => unknown;
    };
    let presignerModule: {
      getSignedUrl: (
        client: S3ClientLike,
        command: unknown,
        options?: { expiresIn?: number },
      ) => Promise<string>;
    };
    try {
      const mod = await dynamicImport("@aws-sdk/client-s3");
      s3Module = mod as unknown as typeof s3Module;
    } catch {
      throw new MissingDependencyError("r2", "@aws-sdk/client-s3");
    }
    try {
      const mod = await dynamicImport("@aws-sdk/s3-request-presigner");
      presignerModule = mod as unknown as typeof presignerModule;
    } catch {
      throw new MissingDependencyError("r2", "@aws-sdk/s3-request-presigner");
    }
    // Webpack/Bun can return an empty namespace for an unresolvable
    // optional peer dep instead of throwing. Catch that here so callers
    // see a useful "install @aws-sdk/client-s3 or switch STORAGE_PROVIDER
    // to local" message instead of `S3Client is not a constructor`.
    if (typeof s3Module.S3Client !== "function") {
      throw new MissingDependencyError("r2", "@aws-sdk/client-s3");
    }
    if (typeof presignerModule.getSignedUrl !== "function") {
      throw new MissingDependencyError("r2", "@aws-sdk/s3-request-presigner");
    }
    this.#client = new s3Module.S3Client({
      region: "auto",
      endpoint: `https://${this.#config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.#config.accessKeyId,
        secretAccessKey: this.#config.secretAccessKey,
      },
    });
    this.#commands = {
      PutObjectCommand: s3Module.PutObjectCommand,
      GetObjectCommand: s3Module.GetObjectCommand,
      HeadObjectCommand: s3Module.HeadObjectCommand,
      DeleteObjectCommand: s3Module.DeleteObjectCommand,
      ListObjectsV2Command: s3Module.ListObjectsV2Command,
    };
    this.#presigner = presignerModule.getSignedUrl;
  }

  async put(
    key: string,
    body: StorageBody,
    options: PutOptions = {},
  ): Promise<StorageFile> {
    await this.#ensure();
    const bytes = await coerceBody(body);
    const cmd = new this.#commands!.PutObjectCommand({
      Bucket: this.#config.bucket,
      Key: key,
      Body: bytes,
      ContentType: options.contentType,
      Metadata: options.metadata,
    });
    try {
      await this.#sendCommand(cmd);
    } catch (err) {
      throw new ProviderError(this.name, "put failed", undefined, err);
    }
    return {
      key,
      size: bytes.byteLength,
      contentType: options.contentType,
      lastModified: new Date(),
      metadata: options.metadata,
    };
  }

  async putSignedUrl(
    key: string,
    options: PutSignedUrlOptions,
  ): Promise<PresignedUpload> {
    await this.#ensure();
    // Do NOT include ContentLength here: AWS SDK signs `content-length`
    // into the URL, then R2 rejects the PUT with 403 because the browser
    // sends the actual file size, not `maxSize`. Size is enforced
    // client-side by `useFileUpload` before the URL is even requested.
    // Same for Metadata — would force the client to send matching
    // x-amz-meta-* headers, but the upload hook only forwards
    // `content-type`.
    const cmd = new this.#commands!.PutObjectCommand({
      Bucket: this.#config.bucket,
      Key: key,
      ContentType: options.contentType,
    });
    const expiresIn = options.expiresIn ?? 300;
    const url = await this.#presigner!(this.#client!, cmd, { expiresIn });
    return {
      url,
      key,
      method: "PUT",
      headers: { "content-type": options.contentType },
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async get(key: string): Promise<{ body: Uint8Array; file: StorageFile }> {
    await this.#ensure();
    const cmd = new this.#commands!.GetObjectCommand({
      Bucket: this.#config.bucket,
      Key: key,
    });
    try {
      const result = (await this.#sendCommand(cmd)) as {
        Body: { transformToByteArray: () => Promise<Uint8Array> };
        ContentType?: string;
        ContentLength?: number;
        LastModified?: Date;
        Metadata?: Record<string, string>;
      };
      const body = await result.Body.transformToByteArray();
      return {
        body,
        file: {
          key,
          size: result.ContentLength ?? body.byteLength,
          contentType: result.ContentType,
          lastModified: result.LastModified ?? null,
          metadata: result.Metadata,
        },
      };
    } catch (err) {
      if (isNotFoundError(err)) throw new FileNotFoundError(key);
      throw new ProviderError(this.name, "get failed", undefined, err);
    }
  }

  async getSignedUrl(key: string, expiresIn = 300): Promise<string> {
    await this.#ensure();
    const cmd = new this.#commands!.GetObjectCommand({
      Bucket: this.#config.bucket,
      Key: key,
    });
    return this.#presigner!(this.#client!, cmd, { expiresIn });
  }

  getPublicUrl(key: string): string | null {
    if (!this.#config.publicUrl) return null;
    return `${this.#config.publicUrl.replace(/\/$/, "")}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.#ensure();
    const cmd = new this.#commands!.DeleteObjectCommand({
      Bucket: this.#config.bucket,
      Key: key,
    });
    try {
      await this.#sendCommand(cmd);
    } catch (err) {
      throw new ProviderError(this.name, "delete failed", undefined, err);
    }
  }

  async list(options: ListOptions = {}): Promise<StorageListResult> {
    await this.#ensure();
    const cmd = new this.#commands!.ListObjectsV2Command({
      Bucket: this.#config.bucket,
      Prefix: options.prefix,
      ContinuationToken: options.cursor,
      MaxKeys: options.limit ?? 100,
    });
    try {
      const result = (await this.#sendCommand(cmd)) as {
        Contents?: Array<{
          Key?: string;
          Size?: number;
          LastModified?: Date;
        }>;
        NextContinuationToken?: string;
      };
      const files = (result.Contents ?? [])
        .filter((o): o is { Key: string; Size?: number; LastModified?: Date } => !!o.Key)
        .map((o) => ({
          key: o.Key,
          size: o.Size ?? 0,
          lastModified: o.LastModified ?? null,
        }));
      return { files, cursor: result.NextContinuationToken ?? null };
    } catch (err) {
      throw new ProviderError(this.name, "list failed", undefined, err);
    }
  }

  async head(key: string): Promise<StorageFile | null> {
    await this.#ensure();
    const cmd = new this.#commands!.HeadObjectCommand({
      Bucket: this.#config.bucket,
      Key: key,
    });
    try {
      const result = (await this.#sendCommand(cmd)) as {
        ContentType?: string;
        ContentLength?: number;
        LastModified?: Date;
        Metadata?: Record<string, string>;
      };
      return {
        key,
        size: result.ContentLength ?? 0,
        contentType: result.ContentType,
        lastModified: result.LastModified ?? null,
        metadata: result.Metadata,
      };
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw new ProviderError(this.name, "head failed", undefined, err);
    }
  }

  #sendCommand(command: unknown): Promise<unknown> {
    return (this.#client as { send: (cmd: unknown) => Promise<unknown> }).send(
      command,
    );
  }
}

interface S3ClientLike {
  send(command: unknown): Promise<unknown>;
}

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
  return name === "NoSuchKey" || name === "NotFound" || status === 404;
}
