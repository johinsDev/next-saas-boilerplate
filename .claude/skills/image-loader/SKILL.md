---
name: image-loader
description: Optimize images in production via a custom Next.js loader that rewrites `<Image>` src through the API Worker's `/img` transform endpoint (resize + webp/avif via `cf.image`). Use when adding a new `<Image>`, picking `sizes`/`placeholder`, debugging "image not transformed", wiring an upload→display flow, or setting up the prod image pipeline.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# image-loader — Worker `cf.image` transforms + `<Image>` patterns

## TL;DR

- `apps/{web,admin}/src/lib/image-loader.ts` is the Next.js custom loader. In **prod** it rewrites every R2-hosted `<Image>` src to the API Worker's transform endpoint: `https://<NEXT_PUBLIC_API_URL>/img/<key>?w=<W>&q=<Q>`. It only rewrites when BOTH `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_IMAGE_CDN_HOST` are set (prod); otherwise it's a no-op (Next default optimizer). External/relative srcs pass through.
- The Worker (`apps/api/src/lib/images.ts` → `GET /img/*`) resizes by fetching a **signed R2 S3 URL** with `fetch(url, { cf: { image } })`, picks webp/avif from the client `Accept`, and caches via the Worker **Cache API** keyed on the request URL.
- Use `next/image` for any raster asset bigger than ~32px. Pass explicit **`sizes`**; use **`placeholder="blur"` + `blurDataURL`** above the fold, or **`fill`** in a sized container for unknown aspect ratios.

## Why a Worker and NOT `/cdn-cgi/image/` (don't re-litigate this)

We tried the URL-form first. It does **not** work in our setup — verified live:

| Approach | Result |
| --- | --- |
| `/cdn-cgi/image/` on the R2-native custom domain (`images.`) | resizing never runs — R2 serves the path directly (no `cf-resized` header, 307 to origin) |
| `/cdn-cgi/image/` on another zone host + cross-origin source | needs "Resize images from any origin" (that toggle is **dev-only**) |
| Origin Rule (Host override) so a proxied host fronts R2 | `400 not entitled to use HostHeader override` — needs a higher CF plan |
| **Worker `fetch(url, { cf: { image } })`** | ✅ works on any plan — it's the Worker's own resizing |

Two gotchas the Worker path then hit (both handled in `images.ts`):

1. The resizing engine **can't read R2 through the public custom domain** — its fetch gets `403` (`cf-resized: err=9408`, same-zone) even though a plain Worker fetch gets `200`. Fix: resize a **signed S3 URL** (`*.r2.cloudflarestorage.com`), via `storage.disk().signedReadUrl(key)` (signs even when the disk is public).
2. The signed URL changes per request, so CF edge can't key on it, and `format: "auto"` didn't convert. Fix: cache via the **Worker Cache API** keyed on the stable request URL, and set the format **explicitly** from `Accept` (`pickFormat`: avif > webp > original), folded into the cache key so variants cache apart.

## Architecture

```
<Image src="https://images.t4diverclub.app/<key>" width={W} />
   │  apps/{web,admin}/src/lib/image-loader.ts   (prod: API_URL && CDN_HOST set)
   ▼
GET https://api.t4diverclub.app/img/<key>?w=W&q=Q          [Accept: image/avif,…]
   │  apps/api/src/index.ts  → app.get("/img/*")
   │   1. Cache API: caches.default.match(url + _f=<fmt>)  → HIT? return
   │   2. transformImage():
   │        format = pickFormat(Accept)            (avif > webp > origin)
   │        source = storage.disk().signedReadUrl(key)   (signed S3 GET, off-zone)
   │        fetch(source, { cf: { image: { width, quality, format } } })
   │        Cache-Control: public, max-age=31536000, immutable
   │   3. waitUntil(cache.put(url + _f, res))
   ▼
resized webp/avif, edge-cached
```

dev/preview: `NEXT_PUBLIC_IMAGE_CDN_HOST` is unset → loader no-op → Next's default optimizer (don't burn transforms per PR).

Key files: loader `apps/{web,admin}/src/lib/image-loader.ts` · Worker `apps/api/src/lib/images.ts` + `src/index.ts` (`/img/*`) · signer `packages/storage/src/disk.ts` (`signedReadUrl`) · config `apps/{web,admin}/next.config.ts` (`images.loader = "custom"`, `remotePatterns` allows `**.t4diverclub.app`).

## Loader contract

```ts
// apps/{web,admin}/src/lib/image-loader.ts (mirror in each app — Next needs a per-app loaderFile)
const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const CDN_HOST = process.env.NEXT_PUBLIC_IMAGE_CDN_HOST;

export default function next-saas-boilerplateImageLoader({ src, width, quality }) {
  if (!API_URL || !CDN_HOST) return src;            // dev/preview → Next default
  const prefix = `https://${CDN_HOST}/`;
  if (!src.startsWith(prefix)) return src;           // external/relative → pass through
  const key = src.slice(prefix.length);
  return `${API_URL}/img/${key}?w=${width}&q=${quality ?? 75}`;
}
```

The loader does NOT add `format` — the Worker derives it from `Accept`. `<Image src>` should be the **public R2 URL** (`https://images.t4diverclub.app/<key>`), which is what `storage` returns from `getDownloadUrl`/`createDownloadUrl` in prod (the disk is public).

## `<Image>` best practices (unchanged)

- Always pass explicit **`sizes`** so Next emits a real `srcset` (`width` flows into the loader's `?w=`).
- Above the fold: `priority` + `placeholder="blur"` + a `blurDataURL`.
- Unknown aspect ratio (user uploads): `fill` inside a `relative` sized container + `className="object-contain"` + `sizes`.
- Inline icons / <32px: use an SVG component, not `<Image>`.

## Upload → display (full flow)

Everything exists; wire it like the dev demo (`apps/admin/src/features/storage/components/dev-page.tsx`, section 0):

1. `<FileUpload onChange={setUrls} accept={{ "image/*": [] }} />` (`apps/admin/src/features/storage/components/file-upload.tsx`) → `useFileUpload` → Hono RPC `storage.createUploadUrl` (presigned PUT) → XHR PUT direct to R2 → Hono RPC `storage.createDownloadUrl` → public URL.
2. Render: `<Image src={urls[0]} fill sizes="400px" />` → loader → Worker `/img` (prod).

## Per-env behaviour

| | dev | preview | prod |
| --- | --- | --- | --- |
| Loader | no-op | no-op | rewrites to Worker `/img` |
| `NEXT_PUBLIC_IMAGE_CDN_HOST` | unset | unset | `images.t4diverclub.app` |
| `NEXT_PUBLIC_API_URL` | unset/local | per-PR | `https://api.t4diverclub.app` |
| Transform | Next default | Next default | Worker `cf.image` |

## Prod setup runbook (one-time, done)

1. R2 bucket → **public Custom Domain** `images.t4diverclub.app` (R2 → Settings → Custom Domains).
2. CF Dashboard → zone `t4diverclub.app` → **Images → Transformations → Enable**.
3. Infisical prod `/shared`: `NEXT_PUBLIC_IMAGE_CDN_HOST=images.t4diverclub.app` (Plain Text). `NEXT_PUBLIC_API_URL` is already set (the auth cutover). No new Worker env — it signs R2 with the `R2_*` creds it already has.
4. Edge caching for `images.` (the originals): run once
   `infisical run --env=prod --path=/ci -- bun run scripts/cloudflare/set-image-cache-rules.ts`
   (needs `CLOUDFLARE_CACHE_RULES_TOKEN` in `/ci` — Cache Settings + Zone Transform Rules: Edit).

## Protected images (seam — not wired yet)

`transformImage` already accepts `isProtected(key)` + `resolveSession(request)`. For images that should be visible only when logged in: store them in a **separate PRIVATE R2 bucket** (no public custom domain) — otherwise the `src` bypasses the gate. The Worker validates the session, signs the private bucket, returns `Cache-Control: private, no-store`. Build this when the first protected-image feature lands.

## Debugging

- **Image not transformed (still original format/size) in prod?** Check the `<Image src>` is the `images.t4diverclub.app` URL (only those rewrite) and that the Network request goes to `api.t4diverclub.app/img/…`. `content-type` should be `image/avif`/`webp` and `cache-control: …immutable`.
- **403 from `/img`?** The signed source is wrong/expired, or the key doesn't exist (404 propagates). Inspect `cf-resized` on the Worker's subrequest — `err=9408` = origin 4xx (signing/key issue).
- **Wrong format cached?** The cache key includes `_f=<avif|webp|origin>` — variants are separate. Bust by changing `w`/`q`.
- **See the flow in prod:** the demo lives at `(dev)/storage` — 404 in prod unless `WHATSAPP_OUTBOX_ENDPOINT_ENABLED=true` (owner-only). Or hit the Worker directly: `https://api.t4diverclub.app/img/demo.jpg?w=400`.

## Cost

Transformations: 5k free/month then ~$0.50/1k on Workers Paid. One "transformation" = a unique `width×quality×format`; repeats are served from the Worker Cache API / CF edge for free.
