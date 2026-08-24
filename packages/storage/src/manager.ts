import { FakeDisk } from "./fake-disk";
import { LocalProvider } from "./providers/local";
import { MemoryProvider } from "./providers/memory";
import { R2FetchProvider } from "./providers/r2-fetch";
import { R2Provider } from "./providers/r2";
import { StorageDisk } from "./disk";
import type {
  DiskConfig,
  StorageLogLevel,
  StorageLogger,
  StorageManagerConfig,
  StorageProvider,
} from "./types";

function createProvider(config: DiskConfig): StorageProvider {
  switch (config.provider) {
    case "memory":
      return new MemoryProvider({ baseUrl: config.baseUrl, secret: config.secret });
    case "local":
      return new LocalProvider({
        rootDir: config.rootDir,
        baseUrl: config.baseUrl,
        secret: config.secret,
      });
    case "r2": {
      const r2Config = {
        accountId: config.accountId,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        bucket: config.bucket,
        publicUrl: config.publicUrl,
      };
      return config.driver === "fetch"
        ? new R2FetchProvider(r2Config)
        : new R2Provider(r2Config);
    }
  }
}

/**
 * Owns the named disks and routes calls to the active one. Same shape
 * as the other channel managers (EmailManager / SmsManager / ...) so
 * testing + bootstrap patterns transfer.
 *
 * @example
 *   export const storage = new StorageManager({
 *     default: "default",
 *     disks: {
 *       default: { provider: "local", baseUrl, secret, rootDir: ".storage" },
 *       avatars: { provider: "r2", accountId, ..., isPublic: true },
 *     },
 *     logger,
 *   });
 *
 *   storage.disk().put("file.png", buf);            // default disk
 *   storage.disk("avatars").putSignedUrl(...);     // named disk
 */
export class StorageManager<
  TDisks extends Record<string, DiskConfig | undefined>,
> {
  readonly #config: StorageManagerConfig<TDisks>;
  readonly #logger?: StorageLogger;
  readonly #logLevel: StorageLogLevel;
  readonly #diskCache = new Map<string, StorageDisk>();
  #fakeDisk?: FakeDisk;

  constructor(
    config: StorageManagerConfig<TDisks> & { logger?: StorageLogger },
  ) {
    const definedDisks = Object.fromEntries(
      Object.entries(config.disks).filter(([, v]) => v !== undefined),
    ) as TDisks;
    this.#config = {
      default: config.default,
      disks: definedDisks,
      keyPrefix: config.keyPrefix,
      logLevel: config.logLevel,
    };
    this.#logger = config.logger;
    this.#logLevel = config.logLevel ?? "info";
  }

  disk<K extends keyof TDisks & string>(diskName?: K): StorageDisk {
    const name = diskName ?? this.#config.default;
    if (!name) {
      throw new Error(
        "No disk name provided and no default configured. Set `default` on StorageManagerConfig.",
      );
    }
    const diskConfig = this.#config.disks[name];
    if (!diskConfig) {
      throw new Error(
        `Unknown disk "${name}". Configured: ${Object.keys(this.#config.disks).join(", ") || "<none>"}`,
      );
    }

    if (this.#fakeDisk) return this.#fakeDisk;

    const cached = this.#diskCache.get(name);
    if (cached) return cached;

    const provider = createProvider(diskConfig);
    const disk = new StorageDisk({
      name,
      provider,
      isPublic: diskConfig.isPublic,
      keyPrefix: this.#config.keyPrefix,
      logger: this.#logger,
      logLevel: this.#logLevel,
    });
    this.#diskCache.set(name, disk);
    return disk;
  }

  /**
   * Entry points for the API Worker's `/api/storage/{upload,serve}` routes.
   * Routes to the default disk's provider (the token carries its own disk +
   * the physical key). Returns 404 when that provider presigns straight to
   * its backend (r2) and has no HTTP handler.
   */
  handleSignedUpload(request: Request): Promise<Response> {
    return this.disk().handleSignedUpload(request);
  }

  handleSignedServe(request: Request): Promise<Response> {
    return this.disk().handleSignedServe(request);
  }

  /** Activate the fake disk. Subsequent `disk()` returns the fake. */
  fake(): FakeDisk {
    this.restore();
    this.#fakeDisk = new FakeDisk();
    return this.#fakeDisk;
  }

  /** Disable fake mode (cleans up after tests). */
  restore(): void {
    this.#fakeDisk = undefined;
  }
}
