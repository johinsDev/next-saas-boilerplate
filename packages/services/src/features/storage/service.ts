import type { PresignedUpload, StorageListResult } from "@saas/storage";
import mimeTypes from "mime-types";

import type { StorageBinding } from "./binding";
import type {
  CreateDownloadUrlInput,
  CreateUploadUrlInput,
  DeleteStorageInput,
  ListStorageInput,
} from "./schemas";

/**
 * Slugify + timestamp a filename into a storage key. Keeps the extension
 * intact so consumers can deduce the file type from the URL.
 *
 *   "Mi avatar.PNG" → "mi-avatar-1715812345678.png"
 */
function fileNameToKey(fileName: string, contentType: string): string {
  const lastDot = fileName.lastIndexOf(".");
  const stem = (lastDot > 0 ? fileName.slice(0, lastDot) : fileName)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";
  const ext = lastDot > 0
    ? fileName.slice(lastDot + 1).toLowerCase()
    : mimeTypes.extension(contentType) || "bin";
  return `${stem}-${Date.now()}.${ext}`;
}

/**
 * Thin pass-through to `StorageManager.disk(...)`. Lives here so future
 * business rules (per-user quotas, content-type allowlists, virus
 * scan hooks) have a single home.
 */
export class StorageService {
  constructor(private readonly storage: StorageBinding) {}

  async createUploadUrl(input: CreateUploadUrlInput): Promise<PresignedUpload> {
    const key = fileNameToKey(input.fileName, input.contentType);
    return this.storage.disk(input.disk).putSignedUrl(key, {
      contentType: input.contentType,
      maxSize: input.maxSize,
    });
  }

  async createDownloadUrl(input: CreateDownloadUrlInput): Promise<{ url: string; key: string }> {
    const url = await this.storage
      .disk(input.disk)
      .getDownloadUrl(input.key, input.expiresIn);
    return { url, key: input.key };
  }

  async delete(input: DeleteStorageInput): Promise<{ ok: true }> {
    await this.storage.disk(input.disk).delete(input.key);
    return { ok: true };
  }

  async list(input: ListStorageInput): Promise<StorageListResult> {
    return this.storage.disk(input.disk).list({
      prefix: input.prefix,
      cursor: input.cursor,
      limit: input.limit,
    });
  }
}
