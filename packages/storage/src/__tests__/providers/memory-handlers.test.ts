import { describe, expect, it } from "vitest";

import { StorageManager } from "../../manager";
import { MemoryProvider } from "../../providers/memory";

const cfg = {
  baseUrl: "http://localhost:8787",
  secret: "test-secret-padding-padding-padding-padding",
};

const bytes = (...n: number[]) => new Uint8Array(n);

describe("MemoryProvider signed-request handlers", () => {
  it("handleSignedUpload stores the body and returns 200", async () => {
    const p = new MemoryProvider(cfg);
    const { url } = await p.putSignedUrl("avatars/x.png", {
      contentType: "image/png",
    });
    const res = await p.handleSignedUpload(
      new Request(url, {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: bytes(1, 2, 3),
      }),
    );
    expect(res.status).toBe(200);
    const { body, file } = await p.get("avatars/x.png");
    expect([...body]).toEqual([1, 2, 3]);
    expect(file.contentType).toBe("image/png");
  });

  it("handleSignedServe returns the bytes + content-type", async () => {
    const p = new MemoryProvider(cfg);
    await p.put("a.png", bytes(9, 9), { contentType: "image/png" });
    const serveUrl = await p.getSignedUrl("a.png");
    const res = await p.handleSignedServe(new Request(serveUrl));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes(9, 9));
  });

  it("upload rejects a body over maxSize with 413", async () => {
    const p = new MemoryProvider(cfg);
    const { url } = await p.putSignedUrl("big.bin", {
      contentType: "application/octet-stream",
      maxSize: 2,
    });
    const res = await p.handleSignedUpload(
      new Request(url, { method: "PUT", body: bytes(1, 2, 3) }),
    );
    expect(res.status).toBe(413);
  });

  it("upload rejects a content-type that doesn't match the token with 415", async () => {
    const p = new MemoryProvider(cfg);
    const { url } = await p.putSignedUrl("x.png", { contentType: "image/png" });
    const res = await p.handleSignedUpload(
      new Request(url, {
        method: "PUT",
        headers: { "content-type": "image/gif" },
        body: bytes(1),
      }),
    );
    expect(res.status).toBe(415);
  });

  it("rejects an invalid token with 401", async () => {
    const p = new MemoryProvider(cfg);
    const res = await p.handleSignedUpload(
      new Request(`${cfg.baseUrl}/api/storage/upload?token=garbage`, {
        method: "PUT",
        body: bytes(),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects a get-mode token on the upload route with 401", async () => {
    const p = new MemoryProvider(cfg);
    const serveUrl = await p.getSignedUrl("a.png");
    const res = await p.handleSignedUpload(
      new Request(serveUrl.replace("/serve", "/upload"), {
        method: "PUT",
        body: bytes(),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("serve returns 404 for a missing key", async () => {
    const p = new MemoryProvider(cfg);
    const serveUrl = await p.getSignedUrl("missing.png");
    const res = await p.handleSignedServe(new Request(serveUrl));
    expect(res.status).toBe(404);
  });
});

describe("StorageManager signed-request delegation", () => {
  it("delegates handleSignedUpload to the active provider", async () => {
    const storage = new StorageManager({
      default: "default",
      disks: { default: { provider: "memory", ...cfg } },
    });
    const { url } = await storage.disk().putSignedUrl("k.png", {
      contentType: "image/png",
    });
    const res = await storage.handleSignedUpload(
      new Request(url, {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: bytes(1),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 when the active provider has no handler (r2)", async () => {
    const storage = new StorageManager({
      default: "default",
      disks: {
        default: {
          provider: "r2",
          driver: "fetch",
          accountId: "a",
          accessKeyId: "k",
          secretAccessKey: "s",
          bucket: "b",
        },
      },
    });
    const res = await storage.handleSignedServe(
      new Request(`${cfg.baseUrl}/api/storage/serve?token=x`),
    );
    expect(res.status).toBe(404);
  });
});
