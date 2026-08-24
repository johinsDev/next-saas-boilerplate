import { describe, expect, it } from "vitest";

import { FakeDisk } from "../fake-disk";
import { StorageManager } from "../manager";

const memoryDisk = {
  provider: "memory" as const,
  baseUrl: "http://localhost:3002",
  secret: "test-secret-padding-padding-padding-padding",
};

describe("StorageManager", () => {
  it("returns the default disk when none specified", () => {
    const manager = new StorageManager({
      default: "default",
      disks: { default: memoryDisk },
    });
    expect(manager.disk().name).toBe("default");
  });

  it("caches disk instances by name", () => {
    const manager = new StorageManager({
      default: "default",
      disks: { default: memoryDisk },
    });
    expect(manager.disk()).toBe(manager.disk());
  });

  it("throws on unknown disk", () => {
    const manager = new StorageManager({
      default: "default",
      disks: { default: memoryDisk },
    });
    expect(() => manager.disk("nope" as "default")).toThrow(/Unknown disk/);
  });

  it("strips undefined disks (conditional config)", () => {
    const manager = new StorageManager({
      default: "default",
      disks: { default: memoryDisk, optional: undefined },
    });
    expect(() => manager.disk("optional" as "default")).toThrow(
      /Unknown disk/,
    );
  });

  it("fake() activates a FakeDisk and restore() reverts", () => {
    const manager = new StorageManager({
      default: "default",
      disks: { default: memoryDisk },
    });
    const fake = manager.fake();
    expect(fake).toBeInstanceOf(FakeDisk);
    expect(manager.disk()).toBe(fake);

    manager.restore();
    expect(manager.disk()).not.toBeInstanceOf(FakeDisk);
  });

  it("multi-disk: each name resolves to its own provider", () => {
    const manager = new StorageManager({
      default: "default",
      disks: {
        default: memoryDisk,
        avatars: { ...memoryDisk, isPublic: true },
      },
    });
    expect(manager.disk("default").isPublic).toBe(false);
    expect(manager.disk("avatars").isPublic).toBe(true);
  });
});
