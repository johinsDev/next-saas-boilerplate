import { describe, expect, it } from "vitest";

import { FakeDisk } from "../fake-disk";

describe("FakeDisk", () => {
  it("seed + assertExists", async () => {
    const fake = new FakeDisk();
    await fake.seed("a.txt", "hello");
    fake.assertExists("a.txt");
    expect(() => fake.assertExists("missing.txt")).toThrow();
  });

  it("assertNotExists", async () => {
    const fake = new FakeDisk();
    fake.assertNotExists("anything");
    await fake.seed("a.txt", "x");
    expect(() => fake.assertNotExists("a.txt")).toThrow();
  });

  it("assertCount (total and prefix)", async () => {
    const fake = new FakeDisk();
    await fake.seed("a.txt", "x");
    await fake.seed("avatars/lucia.png", "x");
    await fake.seed("avatars/juan.png", "x");
    fake.assertCount(3);
    fake.assertCount(2, "avatars/");
  });

  it("assertNonePut", async () => {
    const fake = new FakeDisk();
    fake.assertNonePut();
    await fake.seed("a.txt", "x");
    expect(() => fake.assertNonePut()).toThrow();
  });

  it("clear() empties the disk", async () => {
    const fake = new FakeDisk();
    await fake.seed("a.txt", "x");
    fake.clear();
    expect(fake.keys).toHaveLength(0);
  });

  it("supports put through the StorageDisk surface", async () => {
    const fake = new FakeDisk();
    await fake.put("docs/file.pdf", new TextEncoder().encode("pdf"));
    fake.assertExists("docs/file.pdf");
  });

  it("supports get + delete + list", async () => {
    const fake = new FakeDisk();
    await fake.seed("a.txt", "hello");
    const { body, file } = await fake.get("a.txt");
    expect(new TextDecoder().decode(body)).toBe("hello");
    expect(file.size).toBe(5);

    const list = await fake.list();
    expect(list.files).toHaveLength(1);

    await fake.delete("a.txt");
    fake.assertNotExists("a.txt");
  });
});
