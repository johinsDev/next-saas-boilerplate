import { describe, expect, it } from "vitest";

import { FakeAnalytics } from "../fake-analytics";
import { AnalyticsManager } from "../server";
import type { BaseProperties } from "../types";

const BASE: BaseProperties = {
  app: "web",
  environment: "test",
  locale: "es",
};

function makeManager() {
  return new AnalyticsManager({ provider: { provider: "null" } });
}

describe("AnalyticsManager", () => {
  it("null provider is a noop (no throw, no record)", async () => {
    const m = makeManager();
    const binding = m.forRequest({ distinctId: "user:1", baseProperties: BASE });
    binding.capture("subscription.started", { cardId: "c_1" });
    binding.identify({ email: "x@y.z" });
    binding.page({ $pathname: "/" });
    await m.flush();
    await m.shutdown();
  });

  it("forRequest bakes distinctId + base properties on every call", () => {
    const m = makeManager();
    const fake = m.fake();
    const binding = m.forRequest({ distinctId: "user:42", baseProperties: BASE });

    binding.capture("subscription.started", { cardId: "c_9" });
    binding.page({ $pathname: "/card" });

    expect(fake.captured).toHaveLength(2);
    expect(fake.captured[0]).toEqual({
      distinctId: "user:42",
      event: "subscription.started",
      properties: { app: "web", environment: "test", locale: "es", cardId: "c_9" },
    });
    expect(fake.captured[1]).toMatchObject({
      event: "$pageview",
      distinctId: "user:42",
    });
  });

  it("identify routes through the fake with merged base props", () => {
    const m = makeManager();
    const fake = m.fake();
    const binding = m.forRequest({ distinctId: "user:7", baseProperties: BASE });

    binding.identify({ email: "a@b.c" });

    expect(fake.identified).toEqual([
      {
        distinctId: "user:7",
        properties: { app: "web", environment: "test", locale: "es", email: "a@b.c" },
      },
    ]);
  });
});

describe("FakeAnalytics assertions", () => {
  it("assertCaptured passes when matched and throws when missing", () => {
    const fake = new FakeAnalytics();
    fake.capture({
      distinctId: "u",
      event: "subscription.started",
      properties: { cardId: "c1" },
    });

    fake.assertCaptured("subscription.started");
    fake.assertCaptured("subscription.started", (e) => e.properties.cardId === "c1");
    expect(() => fake.assertCaptured("subscription.cancelled")).toThrow();
    expect(() => fake.assertNotCaptured("subscription.started")).toThrow();
  });

  it("assertIdentified passes on match", () => {
    const fake = new FakeAnalytics();
    fake.identify({ distinctId: "u_1", properties: { email: "x" } });
    fake.assertIdentified("u_1");
    expect(() => fake.assertIdentified("u_2")).toThrow();
  });

  it("clear empties the recording", () => {
    const fake = new FakeAnalytics();
    fake.capture({ distinctId: "u", event: "subscription.started", properties: {} });
    fake.clear();
    expect(fake.captured).toHaveLength(0);
  });
});
