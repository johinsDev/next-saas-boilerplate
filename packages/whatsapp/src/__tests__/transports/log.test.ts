import { describe, expect, it, vi } from "vitest";
import { fakeMessage } from "../../factories";
import { LogTransport } from "../../transports/log";

describe("LogTransport", () => {
  it("writes one structured info call with whatsapp bindings", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const transport = new LogTransport({ provider: "log", logger });

    const res = await transport.send(
      fakeMessage({ to: "+5491155555555", content: "hello" }),
    );

    expect(res.provider).toBe("log");
    expect(res.status).toBe("sent");
    expect(res.providerMessageId).toMatch(/^log-/);
    expect(logger.info).toHaveBeenCalledOnce();
    const [bindings, msg] = logger.info.mock.calls[0]!;
    expect(msg).toBe("whatsapp.sent");
    expect(bindings).toMatchObject({
      _service: "whatsapp",
      provider: "log",
      to: "+5491155555555",
      bodyPreview: "hello",
      bodyLength: 5,
      media: 0,
    });
  });

  it("truncates bodyPreview to 80 chars", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const transport = new LogTransport({ provider: "log", logger });

    const longBody = "a".repeat(200);
    await transport.send(fakeMessage({ content: longBody }));

    const bindings = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect((bindings.bodyPreview as string).length).toBe(80);
    expect(bindings.bodyLength).toBe(200);
  });

  it("reports media count when mediaUrl set", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const transport = new LogTransport({ provider: "log", logger });

    await transport.send(
      fakeMessage({ mediaUrl: "https://example.com/img.png" }),
    );

    const bindings = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(bindings.media).toBe(1);
  });
});
