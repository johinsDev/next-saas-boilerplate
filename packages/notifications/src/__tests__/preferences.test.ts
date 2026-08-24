import { describe, expect, it } from "vitest";
import { isOptOutable } from "../types";
import { resolveChannels } from "../preferences";
import { ORG, StubPreferencesRepository } from "../test-fixtures";

const base = {
  declared: ["mail", "sms", "push"] as const,
  customerId: "cust-1",
  organizationId: ORG,
};

describe("resolveChannels", () => {
  it("passes every declared channel for non-opt-outable categories", async () => {
    const allowed = await resolveChannels({
      ...base,
      category: "transactional",
      preferences: new StubPreferencesRepository(new Set(["mail", "sms"])),
    });
    expect([...allowed].sort()).toEqual(["mail", "push", "sms"]);
  });

  it("treats otp as mandatory", async () => {
    const allowed = await resolveChannels({
      ...base,
      category: "otp",
      preferences: new StubPreferencesRepository(new Set(["mail", "sms", "push"])),
    });
    expect(allowed.size).toBe(3);
  });

  it("filters opted-out channels for marketing", async () => {
    const allowed = await resolveChannels({
      ...base,
      category: "marketing",
      preferences: new StubPreferencesRepository(new Set(["sms"])),
    });
    expect([...allowed].sort()).toEqual(["mail", "push"]);
  });

  it("passes all marketing channels when nothing is opted out", async () => {
    const allowed = await resolveChannels({
      ...base,
      category: "marketing",
      preferences: new StubPreferencesRepository(),
    });
    expect(allowed.size).toBe(3);
  });

  it("treats an unknown category as mandatory", async () => {
    const allowed = await resolveChannels({
      ...base,
      category: "system-alert",
      preferences: new StubPreferencesRepository(new Set(["mail"])),
    });
    expect(allowed.has("mail")).toBe(true);
  });
});

describe("isOptOutable", () => {
  it("only marketing is opt-outable", () => {
    expect(isOptOutable("marketing")).toBe(true);
    expect(isOptOutable("transactional")).toBe(false);
    expect(isOptOutable("otp")).toBe(false);
  });
});
