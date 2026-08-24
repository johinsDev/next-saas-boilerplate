import { describe, expect, it } from "vitest";

import { FakeRealtime } from "../fake";

describe("FakeRealtime", () => {
  it("records every publish", async () => {
    const fake = new FakeRealtime();
    await fake.publish("customer:c_1", { event: "subscription.started", data: { n: 3 } });
    await fake.publish("customer:c_1", { event: "entitlement.ready", data: {} });
    expect(fake.published).toHaveLength(2);
    expect(fake.published[0]?.event.event).toBe("subscription.started");
  });

  it("assertPublished matches by room + predicate", async () => {
    const fake = new FakeRealtime();
    await fake.publish("customer:c_1", { event: "subscription.started", data: { n: 5 } });
    fake.assertPublished("customer:c_1", (e) => e.data.n === 5);
    expect(() =>
      fake.assertPublished("customer:c_1", (e) => e.data.n === 99),
    ).toThrow();
    expect(() => fake.assertPublished("customer:c_OTHER")).toThrow();
  });

  it("assertPublishedCount", async () => {
    const fake = new FakeRealtime();
    await fake.publish("customer:c_1", { event: "a", data: {} });
    await fake.publish("customer:c_1", { event: "b", data: {} });
    fake.assertPublishedCount(2);
    expect(() => fake.assertPublishedCount(1)).toThrow();
  });

  it("assertNonePublished", async () => {
    const fake = new FakeRealtime();
    fake.assertNonePublished();
    await fake.publish("customer:c_1", { event: "a", data: {} });
    expect(() => fake.assertNonePublished()).toThrow();
  });

  it("clear() resets state", async () => {
    const fake = new FakeRealtime();
    await fake.publish("customer:c_1", { event: "a", data: {} });
    fake.clear();
    expect(fake.published).toHaveLength(0);
  });

  it("stamps emittedAt at publish time", async () => {
    const fake = new FakeRealtime();
    const before = Date.now();
    await fake.publish("customer:c_1", { event: "a", data: {} });
    const ts = new Date(fake.published[0]!.event.emittedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(Date.now());
  });
});
