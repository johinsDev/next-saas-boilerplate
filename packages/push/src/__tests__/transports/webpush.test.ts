import { describe, expect, it } from "vitest";

import { MissingDependencyError } from "../../errors";
import { fakeMessage, fakeWebPushSubscription } from "../../factories";
import { WebPushTransport } from "../../transports/webpush";

/**
 * `web-push` is an optional peer dep that isn't installed unless an
 * app picks `provider: "webpush"`. The UT locks in the contract:
 * select the provider without installing the SDK and get a clear
 * error instead of a confusing import failure.
 *
 * Integration with a real browser is verified manually with VAPID
 * keys generated via `bunx web-push generate-vapid-keys`.
 */
describe("WebPushTransport", () => {
  it("has a stable `name` of \"webpush\"", () => {
    const transport = new WebPushTransport({
      provider: "webpush",
      publicKey: "pub",
      privateKey: "priv",
      subject: "mailto:admin@t4.app",
    });
    expect(transport.name).toBe("webpush");
  });

  it("throws MissingDependencyError when `web-push` is not installed", async () => {
    const transport = new WebPushTransport({
      provider: "webpush",
      publicKey: "pub",
      privateKey: "priv",
      subject: "mailto:admin@t4.app",
    });
    await expect(
      transport.send(fakeMessage(), {
        kind: "token",
        token: JSON.stringify(fakeWebPushSubscription()),
        platform: "webpush",
      }),
    ).rejects.toBeInstanceOf(MissingDependencyError);
  });
});
