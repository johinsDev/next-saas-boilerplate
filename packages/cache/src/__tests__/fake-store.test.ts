import { describe, expect, it } from "vitest";

import { FakeStore } from "../fake-store";

describe("FakeStore", () => {
  it("seed + assertHas + assertHasValue + assertMissing", async () => {
    const fake = new FakeStore();
    await fake.seed("k", { name: "Lucia" });

    await fake.assertHas("k");
    await fake.assertHasValue("k", { name: "Lucia" });
    await fake.assertMissing("ghost");
  });

  it("assertHas throws when key missing", async () => {
    const fake = new FakeStore();
    await expect(fake.assertHas("ghost")).rejects.toThrow(
      /Expected cache key "ghost" to exist/,
    );
  });

  it("assertMissing throws when key exists", async () => {
    const fake = new FakeStore();
    await fake.seed("k", 1);
    await expect(fake.assertMissing("k")).rejects.toThrow(
      /Expected cache key "k" to NOT exist/,
    );
  });

  it("assertHasValue throws on mismatch", async () => {
    const fake = new FakeStore();
    await fake.seed("k", { v: 1 });
    await expect(fake.assertHasValue("k", { v: 2 })).rejects.toThrow();
  });
});
