import { describe, expect, it } from "vitest";

import { FakeFlags } from "../fake-flags";
import { FlagsManager } from "../server";

function makeManager() {
  return new FlagsManager({ provider: { provider: "null" } });
}

describe("FlagsManager (null)", () => {
  it("returns the supplied default for isEnabled", async () => {
    const m = makeManager();
    const b = m.forRequest({ distinctId: "user:1" });
    expect(await b.isEnabled("new-checkout-flow")).toBe(false);
    expect(await b.isEnabled("new-checkout-flow", true)).toBe(true);
  });

  it("returns the supplied default for getValue", async () => {
    const m = makeManager();
    const b = m.forRequest({ distinctId: "user:1" });
    expect(await b.getValue("variant-x", "control")).toBe("control");
  });

  it("getAllFlags is empty under null", async () => {
    const m = makeManager();
    const b = m.forRequest({ distinctId: "user:1" });
    expect(await b.getAllFlags()).toEqual({});
  });
});

describe("FlagsManager with FakeFlags", () => {
  it("set() flips checks and records reads with distinctId", async () => {
    const m = makeManager();
    const fake = m.fake().set("new-checkout-flow", true).set("variant-x", "treatment");
    const b = m.forRequest({ distinctId: "user:42" });

    expect(await b.isEnabled("new-checkout-flow")).toBe(true);
    expect(await b.isEnabled("not-set", false)).toBe(false);
    expect(await b.getValue("variant-x")).toBe("treatment");

    fake
      .assertChecked("new-checkout-flow")
      .assertChecked("variant-x")
      .assertChecked("not-set");

    expect(fake.checked.every((c) => c.distinctId === "user:42")).toBe(true);
  });

  it("getAllFlags returns the pinned values", async () => {
    const m = makeManager();
    m.fake().set("a", true).set("b", "treatment");
    const b = m.forRequest({ distinctId: "user:1" });
    expect(await b.getAllFlags()).toEqual({ a: true, b: "treatment" });
  });
});

describe("FakeFlags assertions", () => {
  it("assertChecked throws when never seen", async () => {
    const fake = new FakeFlags();
    await fake.isEnabled({ distinctId: "u", key: "a" });
    fake.assertChecked("a");
    expect(() => fake.assertChecked("b")).toThrow();
  });

  it("clear empties the recording + pinned values", async () => {
    const fake = new FakeFlags().set("a", true);
    await fake.isEnabled({ distinctId: "u", key: "a" });
    fake.clear();
    expect(fake.checked).toHaveLength(0);
    expect(await fake.isEnabled({ distinctId: "u", key: "a" })).toBeUndefined();
  });
});
