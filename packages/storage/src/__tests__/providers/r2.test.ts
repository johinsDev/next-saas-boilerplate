import { describe, expect, it } from "vitest";

import { R2Provider } from "../../providers/r2";

/**
 * R2 is exercised end-to-end via manual smoke against a real Cloudflare
 * bucket — the public surface here is provider-name + public URL
 * helpers. The dynamic-import safety net for missing SDK is covered by
 * the typeof check in `r2.ts#ensure()` itself; once apps/web picks up
 * `@aws-sdk/client-s3` as a real dep, the "uninstalled" UT case no
 * longer fires because the workspace resolves the module everywhere.
 */
describe("R2Provider", () => {
  it("has a stable `name` of 'r2'", () => {
    const r2 = new R2Provider({
      accountId: "fake",
      accessKeyId: "fake",
      secretAccessKey: "fake",
      bucket: "fake",
    });
    expect(r2.name).toBe("r2");
  });

  it("getPublicUrl returns null when no publicUrl configured", () => {
    const r2 = new R2Provider({
      accountId: "fake",
      accessKeyId: "fake",
      secretAccessKey: "fake",
      bucket: "fake",
    });
    expect(r2.getPublicUrl("a.txt")).toBeNull();
  });

  it("getPublicUrl joins publicUrl + key", () => {
    const r2 = new R2Provider({
      accountId: "fake",
      accessKeyId: "fake",
      secretAccessKey: "fake",
      bucket: "fake",
      publicUrl: "https://cdn.example.com",
    });
    expect(r2.getPublicUrl("avatars/lucia.png")).toBe(
      "https://cdn.example.com/avatars/lucia.png",
    );
  });

  it("strips trailing slash from publicUrl", () => {
    const r2 = new R2Provider({
      accountId: "fake",
      accessKeyId: "fake",
      secretAccessKey: "fake",
      bucket: "fake",
      publicUrl: "https://cdn.example.com/",
    });
    expect(r2.getPublicUrl("a.png")).toBe("https://cdn.example.com/a.png");
  });

});
