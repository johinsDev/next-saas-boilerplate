import { describe, expect, it } from "vitest";

import { StorageDisk } from "../disk";
import { R2Provider } from "../providers/r2";
import { MemoryProvider } from "../providers/memory";

describe("StorageDisk", () => {
  it("getDownloadUrl returns signed URL when not public", async () => {
    const memory = new MemoryProvider({
      baseUrl: "http://x.local",
      secret: "test-secret-padding-padding-padding",
    });
    await memory.put("a.txt", "hi");
    const disk = new StorageDisk({
      name: "default",
      provider: memory,
      isPublic: false,
      logLevel: "silent",
    });
    const url = await disk.getDownloadUrl("a.txt");
    expect(url).toContain("/api/storage/serve?token=");
  });

  it("getDownloadUrl throws when disk is public but provider has no public URL", async () => {
    const memory = new MemoryProvider({
      baseUrl: "http://x.local",
      secret: "test-secret-padding-padding-padding",
    });
    await memory.put("a.txt", "hi");
    const disk = new StorageDisk({
      name: "broken-public",
      provider: memory,
      isPublic: true,
      logLevel: "silent",
    });
    await expect(disk.getDownloadUrl("a.txt")).rejects.toThrow(/public/);
  });

  it("getDownloadUrl returns public URL when disk is public and provider has one", async () => {
    const r2 = new R2Provider({
      accountId: "fake-account",
      accessKeyId: "fake",
      secretAccessKey: "fake",
      bucket: "acme-test",
      publicUrl: "https://cdn.example.com",
    });
    const disk = new StorageDisk({
      name: "avatars",
      provider: r2,
      isPublic: true,
      logLevel: "silent",
    });
    const url = await disk.getDownloadUrl("avatars/lucia.png");
    expect(url).toBe("https://cdn.example.com/avatars/lucia.png");
  });
});
