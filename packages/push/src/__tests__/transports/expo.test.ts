import { describe, expect, it } from "vitest";

import { MissingDependencyError } from "../../errors";
import { fakeMessage } from "../../factories";
import { ExpoTransport } from "../../transports/expo";

/**
 * `expo-server-sdk` is an optional peer dep that isn't installed
 * unless an app picks `provider: "expo"` or `provider: "auto"`. The
 * UT locks in the contract: select the provider without installing
 * the SDK and get a clear error instead of a confusing import
 * failure.
 *
 * Integration with the real Expo push API is verified manually once
 * the native app exists.
 */
describe("ExpoTransport", () => {
  it("has a stable `name` of \"expo\"", () => {
    const transport = new ExpoTransport({ provider: "expo" });
    expect(transport.name).toBe("expo");
  });

  it("throws MissingDependencyError when `expo-server-sdk` is not installed", async () => {
    const transport = new ExpoTransport({ provider: "expo" });
    await expect(
      transport.send(fakeMessage(), {
        kind: "token",
        token: "ExponentPushToken[abc]",
        platform: "expo",
      }),
    ).rejects.toBeInstanceOf(MissingDependencyError);
  });
});
