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
  it("INSERTs the email and returns outbox-<id>", async () => {
    const stub = makeStubDb("11111111-1111-4111-8111-111111111111");
    const transport = new OutboxTransport({
      provider: "outbox",
      db: stub.db as never,
    });

    const res = await transport.send(
      fakeMessage({
        to: ["a@example.com", { address: "b@example.com", name: "B" }],
        from: { address: "notifications@acme.app", name: "Acme" },
        cc: ["c@example.com"],
        subject: "Hello",
        html: "<p>Hi</p>",
        text: "Hi",
        tags: [{ name: "kind", value: "welcome" }],
        priority: "high",
      }),
    );

    expect(stub.insert).toHaveBeenCalledOnce();
    const calls = stub.values.mock.calls as unknown as Record<string, unknown>[][];
    const valuesArg = calls[0]?.[0];
    if (!valuesArg) throw new Error("values() was not called");
    expect(valuesArg.to).toBe("a@example.com, b@example.com");
    expect(valuesArg.from).toBe("notifications@acme.app");
    expect(valuesArg.cc).toBe("c@example.com");
    expect(valuesArg.subject).toBe("Hello");
    expect(valuesArg.html).toBe("<p>Hi</p>");
    expect(valuesArg.text).toBe("Hi");
    expect(valuesArg.status).toBe("sent");
    expect(valuesArg.sentAt).toBeInstanceOf(Date);
    expect(valuesArg.metadata).toMatchObject({
      tags: [{ name: "kind", value: "welcome" }],
      priority: "high",
    });

    expect(res.provider).toBe("outbox");
    expect(res.providerMessageId).toBe(
      "outbox-11111111-1111-4111-8111-111111111111",
    );
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
