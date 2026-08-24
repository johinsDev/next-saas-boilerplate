// Public API of @saas/storage.
// See .claude/skills/storage/SKILL.md for the full handbook.

export { StorageDisk } from "./disk";
export { FakeDisk } from "./fake-disk";
export { StorageManager } from "./manager";
export { LocalProvider } from "./providers/local";
export { MemoryProvider } from "./providers/memory";
export { R2Provider } from "./providers/r2";
export { R2FetchProvider } from "./providers/r2-fetch";
export {
  FileNotFoundError,
  FileTooLargeError,
  InvalidTokenError,
  MissingDependencyError,
  ProviderError,
  SignedUrlError,
  StorageError,
} from "./errors";
export { fakePresignedUpload, fakeStorageFile } from "./factories";
export {
  contentTypeSchema,
  diskNameSchema,
  expiresInSchema,
  keySchema,
} from "./schemas";
export { signStorageToken, verifyStorageToken } from "./token";
export type { SignedToken, StorageTokenPayload } from "./token";
export type {
  DiskConfig,
  ListOptions,
  LocalDiskConfig,
  MemoryDiskConfig,
  PresignedUpload,
  PutOptions,
  PutSignedUrlOptions,
  R2DiskConfig,
  StorageBody,
  StorageFile,
  StorageListResult,
  StorageLogger,
  StorageLogLevel,
  StorageManagerConfig,
  StorageProvider,
} from "./types";
