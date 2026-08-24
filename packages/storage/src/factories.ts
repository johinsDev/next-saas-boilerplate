import type { PresignedUpload, StorageFile } from "./types";

export function fakeStorageFile(
  overrides: Partial<StorageFile> = {},
): StorageFile {
  return {
    key: "test/file.txt",
    size: 11,
    contentType: "text/plain",
    lastModified: new Date(),
    ...overrides,
  };
}

export function fakePresignedUpload(
  overrides: Partial<PresignedUpload> = {},
): PresignedUpload {
  return {
    url: "http://fake.local/api/storage/upload?token=fake-token",
    key: "test/file.txt",
    method: "PUT",
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    ...overrides,
  };
}
