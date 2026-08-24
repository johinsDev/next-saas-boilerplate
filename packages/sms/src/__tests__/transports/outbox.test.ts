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
  it("INSERTs the message and returns outbox-<id>", async () => {
    const stub = makeStubDb("11111111-1111-4111-8111-111111111111");
    const transport = new OutboxTransport({
      provider: "outbox",
      db: stub.db as never,
    });

    const res = await transport.send(
      fakeMessage({ to: "+5491155555555", content: "outbox body" }),
    );

    expect(stub.insert).toHaveBeenCalledOnce();
    expect(stub.values).toHaveBeenCalledOnce();
    const calls = stub.values.mock.calls as unknown as Record<string, unknown>[][];
    const valuesArg = calls[0]?.[0];
    if (!valuesArg) throw new Error("values() was not called");
    expect(valuesArg.to).toBe("+5491155555555");
    expect(valuesArg.content).toBe("outbox body");
    expect(valuesArg.status).toBe("sent");
    expect(valuesArg.encoding).toBe("GSM-7");
    expect(valuesArg.segments).toBe(1);
    expect(valuesArg.sentAt).toBeInstanceOf(Date);

    expect(res.provider).toBe("outbox");
    expect(res.providerMessageId).toBe(
      "outbox-11111111-1111-4111-8111-111111111111",
    );
    expect(res.segments?.encoding).toBe("GSM-7");
  });

  it("throws when insert returns no rows", async () => {
    const stub = makeStubDb();
    stub.returning.mockResolvedValueOnce([]);
    const transport = new OutboxTransport({
      provider: "outbox",
      db: stub.db as never,
    });

    await expect(transport.send(fakeMessage())).rejects.toThrow(
      /returned no rows/,
    );
  });
});
