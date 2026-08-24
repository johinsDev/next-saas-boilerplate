import { describe, expect, it } from "vitest";

import { FileNotFoundError } from "../../errors";
import { MemoryProvider } from "../../providers/memory";

const cfg = {
  baseUrl: "http://localhost:3002",
  secret: "test-secret-padding-padding-padding-padding",
};

describe("MemoryProvider", () => {
  it("put + get round-trip", async () => {
    const memory = new MemoryProvider(cfg);
    await memory.put("a.txt", "hello", { contentType: "text/plain" });
    const { body, file } = await memory.get("a.txt");
    expect(new TextDecoder().decode(body)).toBe("hello");
    expect(file.contentType).toBe("text/plain");
    expect(file.size).toBe(5);
  });

  it("get on missing key throws FileNotFoundError", async () => {
    const memory = new MemoryProvider(cfg);
    await expect(memory.get("missing")).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it("putSignedUrl returns a /api/storage/upload URL with token", async () => {
    const memory = new MemoryProvider(cfg);
    const result = await memory.putSignedUrl("avatars/x.png", {
      contentType: "image/png",
      maxSize: 1024,
    });
    expect(result.url).toContain("/api/storage/upload?token=");
    expect(result.key).toBe("avatars/x.png");
    expect(result.method).toBe("PUT");
    expect(result.headers?.["content-type"]).toBe("image/png");
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("getSignedUrl returns a /api/storage/serve URL with token", async () => {
    const memory = new MemoryProvider(cfg);
    await memory.put("a.txt", "x");
    const url = await memory.getSignedUrl("a.txt");
    expect(url).toContain("/api/storage/serve?token=");
  });

  it("getPublicUrl returns null", async () => {
    const memory = new MemoryProvider(cfg);
    expect(memory.getPublicUrl("any.txt")).toBeNull();
  });

  it("list with prefix", async () => {
    const memory = new MemoryProvider(cfg);
    await memory.put("avatars/a.png", "x");
    await memory.put("avatars/b.png", "x");
    await memory.put("docs/x.pdf", "x");
    const result = await memory.list({ prefix: "avatars/" });
    expect(result.files.map((f) => f.key)).toEqual([
      "avatars/a.png",
      "avatars/b.png",
    ]);
  });

  it("delete removes the key", async () => {
    const memory = new MemoryProvider(cfg);
    await memory.put("a.txt", "x");
    await memory.delete("a.txt");
    await expect(memory.get("a.txt")).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it("head returns metadata without body", async () => {
    const memory = new MemoryProvider(cfg);
    await memory.put("a.txt", "hello", { contentType: "text/plain" });
    const file = await memory.head("a.txt");
    expect(file?.size).toBe(5);
    expect(file?.contentType).toBe("text/plain");
  });

  it("head on missing key returns null", async () => {
    const memory = new MemoryProvider(cfg);
    expect(await memory.head("missing")).toBeNull();
  });
});
