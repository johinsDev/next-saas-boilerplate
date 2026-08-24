import { describe, expect, it, vi } from "vitest";

import { fakeMessage } from "../../factories";
import { LogTransport } from "../../transports/log";

describe("LogTransport", () => {
  it("emits one info line with the right bindings", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const transport = new LogTransport({ provider: "log", logger });
    const response = await transport.send(fakeMessage({ title: "Hello", body: "World" }), {
      kind: "token",
      token: "ExponentPushToken[abc-1234567890]",
      platform: "expo",
    });

    expect(logger.info).toHaveBeenCalledTimes(1);
    const [bindings, msg] = logger.info.mock.calls[0] as [
      Record<string, unknown>,
      string,
    ];
    expect(msg).toBe("push.sent");
    expect(bindings._service).toBe("push");
    expect(bindings.provider).toBe("log");
    expect(bindings.platform).toBe("expo");
    expect(bindings.tokenPreview).toBe("ExponentPushToke");
    expect(bindings.tokenPreview as string).toHaveLength(16);
    expect(bindings.title).toBe("Hello");
    expect(bindings.body).toBe("World");
    expect(response.providerMessageId).toMatch(/^log-/);
    expect(response.provider).toBe("log");
    expect(response.platform).toBe("expo");
  });

  it("reports dataKeys", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const transport = new LogTransport({ provider: "log", logger });
    await transport.send(
      fakeMessage({ data: { deepLink: "/card", stamps: 5 } }),
      { kind: "token", token: "ExponentPushToken[abc]", platform: "expo" },
    );
    const [bindings] = logger.info.mock.calls[0] as [
      Record<string, unknown>,
      string,
    ];
    expect(bindings.dataKeys).toEqual(["deepLink", "stamps"]);
  });
});
