import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileNotFoundError } from "../../errors";
import { LocalProvider } from "../../providers/local";

let tmpDir: string;
let provider: LocalProvider;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "acme-storage-"));
  provider = new LocalProvider({
    rootDir: tmpDir,
    baseUrl: "http://localhost:3002",
    secret: "test-secret-padding-padding-padding-padding",
  });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("LocalProvider", () => {
  it("put writes the file + metadata sidecar", async () => {
    await provider.put("avatars/lucia.png", "fakepng", {
      contentType: "image/png",
      metadata: { uploadedBy: "u_1" },
    });
    const filePath = path.join(tmpDir, "avatars/lucia.png");
    const metaPath = `${filePath}.__meta__.json`;
    await expect(fs.access(filePath)).resolves.toBeUndefined();
    const meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
    expect(meta.contentType).toBe("image/png");
    expect(meta.metadata.uploadedBy).toBe("u_1");
    expect(meta.size).toBe(7);
  });

  it("auto-creates parent directories", async () => {
    await provider.put("deep/nested/path/file.txt", "x");
    await expect(
      fs.access(path.join(tmpDir, "deep/nested/path/file.txt")),
    ).resolves.toBeUndefined();
  });

  it("put + get round-trip preserves bytes and metadata", async () => {
    await provider.put("a.txt", "hello", { contentType: "text/plain" });
    const { body, file } = await provider.get("a.txt");
    expect(new TextDecoder().decode(body)).toBe("hello");
    expect(file.contentType).toBe("text/plain");
  });

  it("get on missing key throws FileNotFoundError", async () => {
    await expect(provider.get("missing")).rejects.toBeInstanceOf(
      FileNotFoundError,
    );
  });

  it("rejects path traversal at the provider level", async () => {
    await expect(provider.put("/abs/path", "x")).rejects.toThrow(/traversal/);
    await expect(provider.put("../escape", "x")).rejects.toThrow(/traversal/);
  });

  it("list walks recursively + filters by prefix", async () => {
    await provider.put("avatars/a.png", "x");
    await provider.put("avatars/b.png", "x");
    await provider.put("docs/file.pdf", "x");
    const result = await provider.list({ prefix: "avatars/" });
    expect(result.files.map((f) => f.key)).toEqual([
      "avatars/a.png",
      "avatars/b.png",
    ]);
  });

  it("list excludes .__meta__.json sidecar files", async () => {
    await provider.put("a.txt", "x");
    const result = await provider.list();
    expect(result.files.map((f) => f.key)).toEqual(["a.txt"]);
  });

  it("delete removes both file + meta sidecar", async () => {
    await provider.put("a.txt", "x");
    await provider.delete("a.txt");
    await expect(provider.get("a.txt")).rejects.toBeInstanceOf(
      FileNotFoundError,
    );
    await expect(
      fs.access(path.join(tmpDir, "a.txt.__meta__.json")),
    ).rejects.toThrow();
  });

  it("putSignedUrl returns a /api/storage/upload URL with token", async () => {
    const result = await provider.putSignedUrl("a.txt", {
      contentType: "text/plain",
    });
    expect(result.url).toContain("/api/storage/upload?token=");
  });

  it("head returns metadata when file exists", async () => {
    await provider.put("a.txt", "x", { contentType: "text/plain" });
    const file = await provider.head("a.txt");
    expect(file?.contentType).toBe("text/plain");
  });

  it("head returns null when missing", async () => {
    expect(await provider.head("missing")).toBeNull();
  });
});
