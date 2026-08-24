---
name: storage
description: Upload + serve files in the next-saas-boilerplate monorepo via `@saas/storage`. Three providers (memory / local / r2) with presigned URLs everywhere. Use when adding a new disk, picking a provider per env, debugging a 401/403 on upload, wiring R2 in Cloudflare, or hooking the storage channel into a feature.
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

# storage — provider-agnostic file storage

Sixth strategy package after whatsapp / sms / email / cache / push / realtime. Same Manager / Disk / Provider shape. **Presigned URLs are the default upload path** — the client PUTs directly to R2 in production, directly to a local Next route in dev — so Vercel functions never see the bytes.

For the **UI side** (Dropzone + FileUpload + react-hook-form), see `.claude/skills/file-upload/SKILL.md`.

---

## When to use this vs alternatives

| Need | Reach for |
| --- | --- |
| User uploads a file (avatar, document, photo) | This skill — `useFileUpload` + tRPC `storage.createUploadUrl` |
| Server writes a file once (generated report, backup) | `storage.disk().put(key, body)` directly |
| Display an existing file in the UI | `storage.disk().getDownloadUrl(key)` — picks public/signed automatically |
| One-off temp file in a Trigger.dev task | Memory disk works; or pipe straight to R2 if it needs to persist |
| Long-term archive | R2 — set up a lifecycle rule on the bucket for cold-storage tiering |

---

## Where things live

| What | Where |
| --- | --- |
| Sending package | `packages/storage/src/` |
| Public API | `packages/storage/src/index.ts` |
| Providers | `packages/storage/src/providers/{memory,local,r2}.ts` |
| `StorageDisk` wrapper | `packages/storage/src/disk.ts` |
| `StorageManager` | `packages/storage/src/manager.ts` |
| `FakeDisk` | `packages/storage/src/fake-disk.ts` |
| HMAC token sign/verify | `packages/storage/src/token.ts` |
| Unit tests | `packages/storage/src/__tests__/` |
| tRPC feature | `packages/api/src/features/storage/` |
| Web bootstrap | `apps/web/src/lib/storage.ts` |
| Admin bootstrap | `apps/admin/src/lib/storage.ts` |
| Route handlers | `apps/{web,admin}/app/api/storage/{upload,serve}/route.ts` |
| Web dev view | `apps/web/app/[locale]/(dev)/storage/` |

---

## Provider selection

`apps/{web,admin}/src/lib/storage.ts` picks the default based on the runtime:

| Where | Provider | Why |
| --- | --- | --- |
| Local dev | `local` | Filesystem at `.storage/<disk>/<key>` — survives `next dev` restarts |
| Vercel preview | `memory` (fallback) or `r2` (if keys set) | Memory works for ephemeral demos; preview gets R2 if you configured a preview bucket |
| Vercel production | `r2` | Cloudflare R2 via `@aws-sdk/client-s3` presigned PUT/GET |

Override with `STORAGE_PROVIDER=memory|local|r2`. When R2 is selected, the four `R2_*` env vars become required (validated by `apps/{web,admin}/src/env.ts`).

---

## Presigned URL flow (the meat)

```
┌─ Browser ─────────────────────────────────────────────────────────┐
│ 1. trpc.storage.createUploadUrl.mutate({ fileName, contentType }) │
│            ↓                                                      │
│ 2. Receives { url, key, headers, expiresAt }                      │
│            ↓                                                      │
│ 3. XHR PUT  url  with the raw file body + headers                 │
│            ↓ progress events → UI                                 │
│ 4. trpc.storage.createDownloadUrl.mutate({ key })                 │
│            ↓                                                      │
│ 5. Receives { url } — store this in your form state               │
└────────────────────────────────────────────────────────────────────┘

Step 3 target:
  - memory: /api/storage/upload?token=<hmac-jwt>     (in-process Map)
  - local:  /api/storage/upload?token=<hmac-jwt>     (filesystem)
  - r2:     https://<account>.r2.cloudflarestorage.com/<bucket>/<key>?<aws-presigned-params>
```

The browser never sees the AWS credentials. The Next server doesn't see the bytes (when using R2). The R2 PUT signature is computed server-side once and embedded in the URL.

### HMAC tokens for local/memory

The reference impl in t4-app used raw base64url — easy to tamper. We sign tokens with HS256 via `jose`, reusing `REALTIME_AUTH_SECRET` so apps don't manage two secrets. Payload:

```json
{ "key": "...", "disk": "default", "mode": "put", "contentType": "image/png", "maxSize": 5242880, "exp": 1715812645, "iat": 1715812345 }
```

The route handler at `/api/storage/upload` verifies HMAC, asserts `mode === "put"`, enforces `maxSize` against `Content-Length`, then writes.

---

## Send a file (server-side)

```ts
import { storage } from "@/lib/storage";

// Server-side write — used by generated reports, backups, etc.
await storage.disk().put("reports/2025-q1.pdf", pdfBuffer, {
  contentType: "application/pdf",
  metadata: { generatedBy: "trigger.quarterly-report" },
});

// Read back
const { body, file } = await storage.disk().get("reports/2025-q1.pdf");

// Get a URL the browser can hit (signed by default; public when disk.isPublic)
const url = await storage.disk().getDownloadUrl("reports/2025-q1.pdf", 600);
```

For user uploads, **don't** call `put` server-side. Use the presigned URL flow via tRPC (see the file-upload skill).

---

## API surface (tRPC)

Under `api.storage.*`:

```ts
storage.createUploadUrl.mutate({ fileName, contentType, maxSize?, disk? });
storage.createDownloadUrl.mutate({ key, expiresIn?, disk? });
storage.delete.mutate({ key, disk? });
storage.list.query({ prefix?, limit?, cursor?, disk? });
```

All `protectedProcedure`. The server slugifies + timestamps the filename → key so callers can't trample each other's namespaces by submitting the same name.

---

## Testing

Activate `FakeDisk` via `storage.fake()`:

```ts
beforeEach(() => storage.fake());
afterEach(() => storage.restore());

it("uploads the avatar on sign-up", async () => {
  const fake = storage.fake();
  await runSignUpFlow({ avatar: pngBuffer });
  fake.assertExists("avatars/lucia.png");
  fake.assertCount(1, "avatars/");
});
```

API: `assertExists`, `assertNotExists`, `assertCount(n, prefix?)`, `assertNonePut`, `clear`, `seed(key, body)`. Backed by `MemoryProvider` — same storage that powers preview-deploy fallback.

---

## R2 setup (one-time)

1. **Create the bucket** in Cloudflare dashboard → R2 → Create bucket
   - Name: `next-saas-boilerplate-prod` (or `next-saas-boilerplate-preview`)
   - Region: Auto
2. **Public URL (optional)** — for buckets that serve to the browser without per-image signed URLs:
   - R2 → bucket → Settings → Custom Domains → add `cdn.t4.app`
   - Or use Cloudflare's auto-generated `pub-<hash>.r2.dev` (no custom DNS needed)
3. **API token** — R2 → Manage R2 API Tokens → Create
   - Permissions: Object Read & Write
   - Specify bucket: `next-saas-boilerplate-prod`
   - Copy `Access Key ID` + `Secret Access Key`
4. **Env vars** in Vercel:
   ```
   STORAGE_PROVIDER=r2
   R2_ACCOUNT_ID=<from R2 dashboard, top-right>
   R2_ACCESS_KEY_ID=<from token creation>
   R2_SECRET_ACCESS_KEY=<from token creation>
   R2_BUCKET=next-saas-boilerplate-prod
   R2_PUBLIC_URL=https://pub-xxx.r2.dev   # optional, only if public disk
   ```
5. **CORS** — R2 → bucket → Settings → CORS:
   ```json
   [{
     "AllowedOrigins": ["https://app.t4.app", "https://*.vercel.app"],
     "AllowedMethods": ["GET", "PUT"],
     "AllowedHeaders": ["*"],
     "MaxAgeSeconds": 3600
   }]
   ```
   Without this, the browser's PUT to the presigned URL fails with CORS error.

---

## Adding a new provider

Five steps, same as cache / email / push:

1. Implement `StorageProvider` in `packages/storage/src/providers/<name>.ts` (8 methods: `put` / `putSignedUrl` / `get` / `getSignedUrl` / `getPublicUrl` / `delete` / `list` / `head`).
2. Add the config variant to `DiskConfig` (`types.ts`).
3. Wire it into `createProvider()` in `manager.ts`.
4. Add UTs under `__tests__/providers/<name>.test.ts`.
5. Reference it from the bootstrap in `apps/{web,admin}/src/lib/storage.ts`. Bump `peerDependencies` + `knip.json.packages/storage.ignoreDependencies` if the SDK is optional.

Candidates if needed later: S3 (almost identical to R2), GCS, Supabase Storage, Azure Blob.

---

## Adding a new disk

Already wired — multi-disk is supported but only `default` is configured in v1:

```ts
export const storage = new StorageManager({
  default: "default",
  disks: {
    default: { provider: "r2", ... },
    avatars: { provider: "r2", ..., isPublic: true, bucket: "next-saas-boilerplate-avatars" },
    receipts: { provider: "r2", ..., bucket: "next-saas-boilerplate-receipts" },
  },
});

// then:
storage.disk("avatars").putSignedUrl("lucia.png", { contentType: "image/png" });
storage.disk("receipts").getDownloadUrl("r_123.pdf");
```

Why split: per-feature buckets get their own ACL, lifecycle (auto-delete after N days), and CORS policy. The customer party file size for avatars is tiny; receipts might want to be private + long-lived.

---

## Common pitfalls

- **CORS** on R2 is the #1 cause of "the upload silently fails". DevTools → Network tab → look for the failed `PUT` to `<account>.r2.cloudflarestorage.com`. If it shows preflight failure, fix CORS.
- **`Content-Type` header on PUT** — the presigned URL bakes in the content type. The client MUST send the same value on the PUT (the `useFileUpload` hook does this automatically). Mismatch → 403 from R2.
- **`maxSize` enforcement** — local/memory enforce server-side via the JWT payload + `Content-Length` check. R2 enforces it through `ContentLength` baked into the presigned URL. Pre-flight in the hook saves a round-trip.
- **Path traversal** — `keySchema` forbids absolute paths + `..`. LocalProvider double-checks in `#filePath()`. Don't bypass either when adding routes.
- **`STORAGE_PROVIDER=r2` without env vars** → boot fails with a clear error. Set the four `R2_*` envs or switch the provider.
- **The dev server disables the service worker** so HMR works. Storage doesn't care, but if you're also testing push notifications nearby, remember to `bun run build && start` for full PWA behavior.
- **Tokens are short-lived (5 min)** — that's intentional. If you display a signed URL on a page that lives longer, call `getDownloadUrl` on each render, or set the disk to `isPublic: true` and let the public CDN URL never expire.

---

## See also

- `.claude/skills/file-upload/SKILL.md` — Dropzone primitive + `useFileUpload` hook + react-hook-form bridge + Storybook stories
- `.claude/skills/api-filters/SKILL.md` — feature pattern this `storage` feature follows
- `.claude/skills/cache/SKILL.md` / `email/SKILL.md` / `push/SKILL.md` — sibling channels with the same shape
