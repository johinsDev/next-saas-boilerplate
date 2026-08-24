import { describe, expect, it, vi } from "vitest";

import { fakeMessage } from "../../factories";
import { LogTransport } from "../../transports/log";

describe("LogTransport", () => {
  it("writes one structured info call with email bindings", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const transport = new LogTransport({ provider: "log", logger });

    const res = await transport.send(
      fakeMessage({
        to: ["a@example.com"],
        from: "notifications@acme.app",
        subject: "Hi",
        html: "<p>Hi</p>",
        text: "Hi",
      }),
    );

    expect(res.provider).toBe("log");
    expect(res.status).toBe("sent");
    expect(res.providerMessageId).toMatch(/^log-/);
    expect(logger.info).toHaveBeenCalledOnce();
    const [bindings, msg] = logger.info.mock.calls[0]!;
    expect(msg).toBe("email.sent");
    expect(bindings).toMatchObject({
      _service: "email",
      provider: "log",
      to: ["a@example.com"],
      from: "notifications@acme.app",
      subject: "Hi",
      htmlLength: 9,
      textLength: 2,
      attachments: 0,
    });
  });

  it("truncates bodyPreview to 80 chars", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const transport = new LogTransport({ provider: "log", logger });

    const longBody = "a".repeat(200);
    await transport.send(fakeMessage({ text: longBody }));

    const bindings = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect((bindings.bodyPreview as string).length).toBe(80);
    expect(bindings.bodyLength).toBe(200);
  });

  it("reports attachment count", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const transport = new LogTransport({ provider: "log", logger });

    await transport.send(
      fakeMessage({
        attachments: [
          { filename: "a.pdf", content: "data1" },
          { filename: "b.pdf", content: "data2" },
        ],
      }),
    );

    const bindings = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(bindings.attachments).toBe(2);
  });
});
