---
name: cache
description: Read-through cache for the next-saas-boilerplate monorepo via `@saas/cache`. Use when caching a DB query (`getOrSet`), invalidating after a write, picking a provider for an environment, adding a new provider, faking the cache in tests, or debugging stale data. Default provider is **Upstash** (serverless-friendly REST) — also ships memory + ioredis.
---

> **Ported from `loyalty-app`, not yet rewritten for the app.** Two things differ:
>
> - **There is no tRPC here.** The typed API is **Hono RPC** (`hc<AppType>`, types only —
>   no runtime RPC, which is the whole reason we picked it over tRPC).
> - **Web and admin call `packages/services` directly**, in Server Components and Server
>   Actions. They never hop through the Hono API. Only mobile goes over HTTP.
>
> Where this file shows a tRPC procedure, read it as a service function. Some packages it
> names do not exist yet — it describes the target, not the current tree. The
> `architecture-guard` skill is the authority.

# @saas/cache — read-through cache + provider strategy

`@saas/cache` is a thin abstraction over a key-value store. Same shape as `@saas/sms` / `@saas/whatsapp`: a `Manager` owns named `Stores`, each `Store` wraps a `Provider`, and there's a `FakeStore` you swap in for tests. Adds JSON serialization on read/write plus the `getOrSet(key, factory, ttl)` convenience.

The default provider in preview + production is **Upstash** because it's REST-based — Vercel cold-starts don't kill it the way they kill long-lived `ioredis` connections.

---

## Where things live

| What | Where |
| --- | --- |
| Package | `packages/cache/src/` |
| Public API barrel | `packages/cache/src/index.ts` |
| `CacheManager` | `packages/cache/src/manager.ts` |
| `CacheStore` (JSON + getOrSet + logging) | `packages/cache/src/cache-store.ts` |
| `FakeStore` | `packages/cache/src/fake-store.ts` |
| Providers | `packages/cache/src/providers/{memory,upstash,redis}.ts` |
| Errors | `packages/cache/src/errors.ts` |
| Unit tests | `packages/cache/src/__tests__/` |
| Web bootstrap | `apps/web/src/lib/cache.ts` |
| Admin bootstrap | `apps/admin/src/lib/cache.ts` |

---

## Send a cache call

### Read-through (the most common pattern)

```ts
import { cache } from "@/lib/cache";

const customer = await cache.getOrSet(
  `customer:${id}`,
  () => repo.findById(id),
  300, // TTL in seconds
);
```

Factory only fires on a miss. Hits return the cached value (deserialized from JSON automatically).

### Direct read / write

```ts
await cache.set("session:abc", { userId: "u1" }, 60);
const session = await cache.get<{ userId: string }>("session:abc");
```

### Invalidation after writes

```ts
await repo.updateCustomer(id, patch);
await cache.delete(`customer:${id}`);
// or batch:
await cache.deleteMany([`customer:${id}`, `customer-list:org:${orgId}`]);
```

### Pick a specific store

```ts
// Default is whatever `CACHE_PROVIDER` resolves to. Use a named one explicitly:
await cache.use("memory").set("tmp", "x");
```

---

## Provider cascade

`apps/{web,admin}/src/lib/cache.ts` picks the default based on the runtime:

| Where | Provider | Why |
| --- | --- | --- |
| Local dev | `memory` | Zero setup, process-local. Restart clears it. |
| Vercel preview | `upstash` | REST → no persistent connection → survives cold starts. |
| Vercel production | `upstash` | Same reason. |

Override with `CACHE_PROVIDER=memory|upstash|redis`.

### Required env per provider

| Provider | Required when selected |
| --- | --- |
| `memory` | _(nothing)_ |
| `upstash` | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| `redis` | `REDIS_URL` (e.g. `redis://localhost:6379`) |

Validated by `apps/{web,admin}/src/env.ts` via `@t3-oss/env-nextjs` + the shared `requireWhen` helper. Boot fails if any required var is missing when its provider is selected.

### Why Upstash by default

Vercel runs Next.js routes in isolated, short-lived containers. A traditional Redis client (`ioredis`) keeps a TCP socket open per process — on Vercel that socket is recreated on every cold start, hammers your Redis with reconnects, and leaks sockets when containers die mid-request. Upstash's HTTP-based client makes one stateless request per call — no connection pool, no reconnect storm, no socket leaks. It's the default in preview + production for that reason.

`ioredis` stays available for self-hosted environments and for `packages/jobs` (Trigger.dev) where the worker process is long-lived.

---

## `getOrSet` semantics

```ts
await cache.getOrSet(key, factory, ttlSeconds?);
```

1. `get(key)` — if cached, return immediately (hit).
2. Otherwise call `factory()` and `set(key, value, ttlSeconds)` — return the fresh value.
3. Errors in the factory propagate; nothing is cached.

**Watch out for:** caching `null` / `undefined`. The store treats `null` as "miss", so a factory that returns `null` will re-run on every call. If you need to cache absence, wrap it: `{ value: null, cachedAt: ... }`.

**Race conditions:** under heavy concurrent traffic two requests may both miss + both compute. That's usually fine (idempotent reads) but be aware if the factory has side effects or is expensive.

---

## Testing with `FakeStore`

```ts
import { cache } from "@/lib/cache";
import { customerService } from "@/features/customers/service";

beforeEach(() => cache.fake());
afterEach(() => cache.restore());

it("uses the cached customer on second call", async () => {
  const fake = cache.fake();
  await fake.seed("customer:u1", { id: "u1", name: "Lucia" });

  const got = await customerService.findById("u1");

  expect(got).toEqual({ id: "u1", name: "Lucia" });
  await fake.assertHas("customer:u1");
});

it("invalidates the cache after update", async () => {
  const fake = cache.fake();
  await fake.seed("customer:u1", { id: "u1", name: "Lucia" });

  await customerService.update("u1", { name: "Lu" });

  await fake.assertMissing("customer:u1");
});
```

`FakeStore` extends `CacheStore` with assertion helpers (`assertHas`, `assertMissing`, `assertHasValue`) + a `seed()` shortcut. Process-local memory underneath — nothing reaches network.

---

## Adding a new provider

Five mechanical steps. Clone an existing provider as the template (the memory provider is the simplest, upstash the closest to most real-world cases).

**1. Implement `CacheProvider` in `packages/cache/src/providers/<name>.ts`**

```ts
import { ProviderError } from "../errors";
import type { CacheProvider, MyProviderConfig } from "../types";

export class MyProvider implements CacheProvider {
  readonly name = "my-provider";
  readonly #config: MyProviderConfig;
  #client: unknown;

  constructor(config: MyProviderConfig) {
    this.#config = config;
  }

  async #getClient(): Promise<MyClientLike> {
    if (this.#client) return this.#client as MyClientLike;
    // Lazy-import the SDK so apps that don't pick this provider don't load it.
    // Wrap in try/catch and throw MissingDependencyError if the SDK isn't installed.
    // ...
  }

  async get(key: string) { /* ... */ }
  async set(key: string, value: string, ttlSeconds?: number) { /* ... */ }
  async delete(key: string) { /* ... */ }
  async has(key: string) { /* ... */ }
  async flush() { /* ... */ }
  async disconnect?() { /* if the client has a connection */ }
}
```

**2. Add the config variant to `types.ts`**

```ts
export interface MyProviderConfig {
  provider: "my-provider";
  // …connection params
}

export type ProviderConfig = /* … */ | MyProviderConfig;
```

**3. Wire it into `createProvider()` in `manager.ts`**

```ts
case "my-provider":
  return new MyProvider(config);
```

**4. Add a UT under `__tests__/providers/<name>.test.ts`**

Follow the memory or upstash pattern. If your provider lazy-loads an optional SDK, test the `MissingDependencyError` path (it's the easiest deterministic UT you can write without the real service).

**5. Update the bootstrap + env**

Add the env vars + `requireWhen` predicate in `apps/{web,admin}/src/env.ts`, and the conditional config block in `apps/{web,admin}/src/lib/cache.ts`. Bump the package's `peerDependencies` if you use an SDK that should be optional. Add the package name to `knip.json` under `packages/cache.ignoreDependencies` so knip stops flagging the optional SDK as orphan.

Six files in total. Don't add the provider to `index.ts` exports unless you want it usable outside the manager (you usually don't — the manager already routes by config).

---

## Common pitfalls

- **Caching null/undefined.** The store interprets `null` as "miss". Wrap the value or use a sentinel.
- **Setting without TTL.** Without a TTL the entry persists forever (or until eviction). Always pass `ttlSeconds` for derived data; only omit when the value is truly long-lived (config, feature flags).
- **Key naming.** Prefix by domain: `customer:${id}`, `whatsapp-outbox-list:${page}`. Makes invalidation greppable and avoids cross-feature collisions.
- **Fake mode persisting across tests.** Call `cache.restore()` in `afterEach`. Forgetting to restore means the next test sees the previous test's seeds.
- **Forgetting invalidation.** A read-through cache + a stale write = the most common cache bug. Whenever a write happens, delete the keys that depend on the changed row.
- **`[upstash] @upstash/redis is not installed` (500 in preview/prod, fine locally).** A deploy gotcha, fixed in PR #73. Upstash is the default provider in preview/prod, but the SDK is loaded via the `new Function("specifier","return import(specifier)")` wrapper in `_lazy.ts`, which `@vercel/nft` **cannot trace** — so it's neither auto-installed (optional peers aren't) nor auto-copied into the lambda (`serverExternalPackages` only stops bundling). Two things keep it working, both in `apps/{web,admin}`: (1) `@upstash/redis` declared as a real dep (+ in the app's knip `ignoreDependencies`); (2) `outputFileTracingIncludes` + `outputFileTracingRoot` in `next.config.ts` force-copy `@upstash/**` + `uncrypto` into every route's lambda. `@saas/rate-limit` shares the same glob — see its skill for the full chain. Verify after a build: the route's `.nft.json` should list `@upstash/redis`. If you add a new upstash-backed route/app, it's covered by the `/**` key; if you switch cache to a *different* SDK as the preview/prod default, add that package to the same `outputFileTracingIncludes`.

---

## Quick reference

```ts
import { cache } from "@/lib/cache";

// Read-through (most common)
const customer = await cache.getOrSet(`customer:${id}`, () => repo.findById(id), 300);

// Direct read / write
await cache.set("k", value, 60);
const v = await cache.get<T>("k");

// Existence
await cache.has("k");
await cache.missing("k");

// Invalidation
await cache.delete("k");
await cache.deleteMany(["k1", "k2"]);
await cache.flush(); // dangerous — clears the whole store

// Pick a specific store
await cache.use("memory").set("temp", 1);

// Tests
const fake = cache.fake();
await fake.seed("k", { v: 1 });
await fake.assertHas("k");
cache.restore();
```
