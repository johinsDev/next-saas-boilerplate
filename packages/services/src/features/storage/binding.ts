import type { StorageManager } from "@saas/storage";

/**
 * What the storage service needs from its host.
 *
 * Passed in rather than imported, so the same service runs behind the Worker
 * (where the binding comes from the request) and in the Next server (where it
 * comes from the process).
 */
export type StorageBinding = StorageManager<Record<string, never>>;
