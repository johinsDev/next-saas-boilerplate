import { AwsClient } from "aws4fetch";

import { FileNotFoundError, ProviderError } from "../errors";
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
import type { R2ProviderConfig } from "./r2";

/**
 * Cloudflare R2 (S3-compatible) provider — the Workers-safe twin of
 * {@link R2Provider}. Identical semantics, but built on **aws4fetch**
 * (pure Web Crypto + `fetch`) instead of the AWS SDK.
 *
 * Why a second provider: the AWS SDK reaches for a `new Function`-based
 * dynamic import that `workerd` (Cloudflare Workers) forbids, so it
 * cannot run there. aws4fetch only touches `crypto.subtle` + `fetch`,
 * both first-class in Workers. Node keeps using {@link R2Provider}; the
 * Worker runtime selects this one via `R2DiskConfig.driver: "fetch"`.
 *
 * Presigned PUT + GET URLs are minted by query-signing the object URL;
 * the client uploads/downloads directly against R2, bypassing the
 * server. XML list responses are parsed with small regexes (no DOM /
 * node XML lib, which Workers don't ship).
 *
 * Maps HTTP statuses:
 *   - 404 → `FileNotFoundError`
 *   - other → `ProviderError` (with status + a short body slice)
 */
export class R2FetchProvider implements StorageProvider {
  readonly name = "r2";
  readonly #config: R2ProviderConfig;
  readonly #client: AwsClient;

  constructor(config: R2ProviderConfig) {
    this.#config = config;
    this.#client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: "s3",
      region: "auto",
      // No automatic retries: surface failures to the caller as
      // ProviderError immediately (the StorageDisk layer owns retry policy).
      retries: 0,
    });
  }

  /** `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>` with each key segment encoded (slashes preserved). */
  #objectUrl(key: string): string {
    const encodedKey = key
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${this.#bucketUrl()}/${encodedKey}`;
  }

  /** `https://<account>.r2.cloudflarestorage.com/<bucket>` (bucket-level, for list). */
  #bucketUrl(): string {
    return `https://${this.#config.accountId}.r2.cloudflarestorage.com/${this.#config.bucket}`;
  }

  async put(
    key: string,
    body: StorageBody,
    options: PutOptions = {},
  ): Promise<StorageFile> {
    const bytes = await coerceBody(body);
    const headers: Record<string, string> = {};
    if (options.contentType) headers["content-type"] = options.contentType;
    for (const [k, v] of Object.entries(options.metadata ?? {})) {
      headers[`x-amz-meta-${k}`] = v;
    }
    const res = await this.#client.fetch(this.#objectUrl(key), {
      method: "PUT",
      // Re-wrap into a fresh ArrayBuffer-backed Uint8Array: `coerceBody` returns
      // `Uint8Array<ArrayBufferLike>` (TS 5.7 generic), which the fetch body type
      // rejects; `Uint8Array<ArrayBuffer>` is accepted. Avoids a `BodyInit` cast
      // (not a referenceable name under the package's DOM-less lib).
      body: new Uint8Array(bytes),
      headers,
    });
    if (!res.ok) {
      throw await this.#providerError("put failed", res);
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
    const expiresIn = options.expiresIn ?? 300;
    // Sign ONLY content-type. Do NOT sign content-length or metadata:
    // aws4fetch would fold them into the signature, and the browser
    // upload (useFileUpload) only echoes `content-type` — a signed
    // content-length / x-amz-meta-* would force the PUT to match exactly
    // and R2 would 403 it. Size is enforced client-side before the URL
    // is requested. (Same rule as the AWS-SDK R2Provider.)
    const url = new URL(this.#objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(expiresIn));
    const signed = await this.#client.sign(url.toString(), {
      method: "PUT",
      aws: { signQuery: true },
      headers: { "content-type": options.contentType },
    });
    return {
      url: signed.url,
      key,
      method: "PUT",
      headers: { "content-type": options.contentType },
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async get(key: string): Promise<{ body: Uint8Array; file: StorageFile }> {
    const res = await this.#client.fetch(this.#objectUrl(key));
    if (res.status === 404) throw new FileNotFoundError(key);
    if (!res.ok) {
      throw await this.#providerError("get failed", res);
    }
    const body = new Uint8Array(await res.arrayBuffer());
    return { body, file: this.#fileFromHeaders(key, res.headers, body.byteLength) };
  }

  async getSignedUrl(key: string, expiresIn = 300): Promise<string> {
    const url = new URL(this.#objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(expiresIn));
    const signed = await this.#client.sign(url.toString(), {
      method: "GET",
      aws: { signQuery: true },
    });
    return signed.url;
  }

  getPublicUrl(key: string): string | null {
    if (!this.#config.publicUrl) return null;
    return `${this.#config.publicUrl.replace(/\/$/, "")}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const res = await this.#client.fetch(this.#objectUrl(key), {
      method: "DELETE",
    });
    // S3/R2 returns 204 on a successful delete; 404 is idempotent-success.
    if (res.status === 204 || res.status === 404) return;
    throw await this.#providerError("delete failed", res);
  }

  async list(options: ListOptions = {}): Promise<StorageListResult> {
    const url = new URL(this.#bucketUrl());
    url.searchParams.set("list-type", "2");
    if (options.prefix) url.searchParams.set("prefix", options.prefix);
    if (options.cursor) url.searchParams.set("continuation-token", options.cursor);
    url.searchParams.set("max-keys", String(options.limit ?? 100));
    const res = await this.#client.fetch(url.toString());
    if (!res.ok) {
      throw await this.#providerError("list failed", res);
    }
    return parseListXml(await res.text());
  }

  async head(key: string): Promise<StorageFile | null> {
    const res = await this.#client.fetch(this.#objectUrl(key), {
      method: "HEAD",
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw await this.#providerError("head failed", res);
    }
    return this.#fileFromHeaders(key, res.headers);
  }

  #fileFromHeaders(
    key: string,
    headers: Headers,
    fallbackSize?: number,
  ): StorageFile {
    const contentLength = headers.get("content-length");
    const lastModified = headers.get("last-modified");
    const metadata: Record<string, string> = {};
    headers.forEach((value, name) => {
      if (name.startsWith("x-amz-meta-")) {
        metadata[name.slice("x-amz-meta-".length)] = value;
      }
    });
    return {
      key,
      size: contentLength !== null ? Number(contentLength) : (fallbackSize ?? 0),
      contentType: headers.get("content-type") ?? undefined,
      lastModified: lastModified ? new Date(lastModified) : null,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  async #providerError(message: string, res: Response): Promise<ProviderError> {
    let bodySlice = "";
    try {
      bodySlice = (await res.text()).slice(0, 200);
    } catch {
      // body may be unreadable (already consumed / stream); ignore.
    }
    return new ProviderError(
      this.name,
      `${message} (status ${res.status})${bodySlice ? `: ${bodySlice}` : ""}`,
      String(res.status),
    );
  }
}

/** Decode the five XML entities S3 escapes in `<Key>` values. */
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function matchTag(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(block);
  return m ? m[1]! : null;
}

/**
 * Parse an S3 `ListObjectsV2` XML response with regexes only — no DOM /
 * node XML parser (Workers ship neither). Extracts each `<Contents>`
 * block's `<Key>` / `<Size>` / `<LastModified>` plus the top-level
 * `<NextContinuationToken>`.
 */
function parseListXml(xml: string): StorageListResult {
  const files: StorageFile[] = [];
  const contentsRe = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match: RegExpExecArray | null;
  while ((match = contentsRe.exec(xml)) !== null) {
    const block = match[1]!;
    const rawKey = matchTag(block, "Key");
    if (!rawKey) continue;
    const size = matchTag(block, "Size");
    const lastModified = matchTag(block, "LastModified");
    files.push({
      key: decodeXmlEntities(rawKey),
      size: size ? Number(size) : 0,
      lastModified: lastModified ? new Date(lastModified) : null,
    });
  }
  const cursor = matchTag(xml, "NextContinuationToken");
  return { files, cursor: cursor ? decodeXmlEntities(cursor) : null };
}
