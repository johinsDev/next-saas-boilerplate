import { describe, expect, it, vi } from "vitest";

import { fakeMessage } from "../../factories";
import { OutboxTransport } from "../../transports/outbox";

function makeStubDb(insertedId = "00000000-0000-4000-8000-000000000000") {
  const returning = vi.fn().mockResolvedValue([{ id: insertedId }]);
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  return { db: { insert }, insert, values, returning };
}

describe("OutboxTransport", () => {
  it("INSERTs the push and returns outbox-<id>", async () => {
    const stub = makeStubDb("22222222-2222-4222-8222-222222222222");
    const transport = new OutboxTransport({
      provider: "outbox",
      db: stub.db as never,
    });

    const res = await transport.send(
      fakeMessage({
        title: "Order shipped",
        body: "Nice tea coming",
        data: { stamps: 5 },
        badge: 1,
        icon: "/icon.png",
        clickAction: "/card",
        priority: "high",
      }),
      {
        kind: "token",
        token: "ExponentPushToken[device-abc]",
        platform: "expo",
      },
    );

    expect(stub.insert).toHaveBeenCalledOnce();
    const calls = stub.values.mock.calls as unknown as Record<string, unknown>[][];
    const valuesArg = calls[0]?.[0];
    if (!valuesArg) throw new Error("values() was not called");
    expect(valuesArg.deviceToken).toBe("ExponentPushToken[device-abc]");
    expect(valuesArg.platform).toBe("expo");
    expect(valuesArg.title).toBe("Order shipped");
    expect(valuesArg.body).toBe("Nice tea coming");
    expect(valuesArg.data).toEqual({ stamps: 5 });
    expect(valuesArg.status).toBe("sent");
    expect(valuesArg.sentAt).toBeInstanceOf(Date);
    expect(valuesArg.metadata).toMatchObject({
      badge: 1,
      icon: "/icon.png",
      clickAction: "/card",
      priority: "high",
    });

    expect(res.provider).toBe("outbox");
    expect(res.providerMessageId).toBe(
      "outbox-22222222-2222-4222-8222-222222222222",
    );
    expect(res.platform).toBe("expo");
  });

  it("throws when insert returns no rows", async () => {
    const stub = makeStubDb();
    stub.returning.mockResolvedValueOnce([]);
    const transport = new OutboxTransport({
      provider: "outbox",
      db: stub.db as never,
    });

    await expect(
      transport.send(fakeMessage(), {
        kind: "token",
        token: "ExponentPushToken[abc]",
        platform: "expo",
      }),
    ).rejects.toThrow(/returned no rows/);
  });
});
