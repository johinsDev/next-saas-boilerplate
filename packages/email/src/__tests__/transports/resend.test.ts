import { describe, expect, it } from "vitest";

import { MissingDependencyError } from "../../errors";
import { ResendTransport } from "../../transports/resend";

/**
 * `resend` is an optional peer dep that isn't installed in this
 * monorepo unless an app picks `provider: "resend"`. The UT locks
 * in the contract: select the provider without installing the SDK
 * and get a clear error instead of a confusing import failure.
 *
 * Integration with real Resend is verified manually against a preview
 * deploy (`RESEND_API_KEY` set).
 */
describe("ResendTransport", () => {
  it("has a stable `name` of \"resend\"", () => {
    const provider = new ResendTransport({
      provider: "resend",
      apiKey: "fake",
    });
    expect(provider.name).toBe("resend");
  });

  it("throws MissingDependencyError when `resend` is not installed", async () => {
    const provider = new ResendTransport({
      provider: "resend",
      apiKey: "fake",
      from: "notifications@acme.app",
    });
    await expect(
      provider.send({
        to: ["a@example.com"],
        subject: "hi",
        text: "hi",
      }),
    ).rejects.toBeInstanceOf(MissingDependencyError);
  });
});
