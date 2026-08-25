import { describe, expect, test, vi } from "vitest";

import { QueueTransport } from "./queue";
import type { EmailMessageData } from "../types";

const message = {
  to: ["someone@example.com"],
  subject: "Welcome",
  html: "<p>hi</p>",
} as unknown as EmailMessageData;

describe("QueueTransport", () => {
  test("hands the message to the dispatcher instead of delivering it", async () => {
    const dispatch = vi.fn().mockResolvedValue({ id: "run_123" });

    const response = await new QueueTransport({ provider: "queue", dispatch }).send(message);

    expect(dispatch).toHaveBeenCalledWith(message);
    expect(response.status).toBe("queued");
  });

  test("reports queued, never sent", async () => {
    /*
     * The distinction is the whole point. Nothing has reached a provider yet, so
     * claiming `sent` would make a queued email indistinguishable from a
     * delivered one — and the outbox view, the tests and the audit trail all
     * read this field.
     */
    const response = await new QueueTransport({
      provider: "queue",
      dispatch: async () => ({ id: "run_1" }),
    }).send(message);

    expect(response.status).toBe("queued");
    expect(response.provider).toBe("queue");
  });

  test("carries the run id back, so a caller can follow the work", async () => {
    const response = await new QueueTransport({
      provider: "queue",
      dispatch: async () => ({ id: "run_abc" }),
    }).send(message);

    expect(response.providerMessageId).toBe("run_abc");
  });

  test("lets a dispatch failure through rather than swallowing it", async () => {
    // A queue that is down must not look like a delivered email.
    const dispatch = vi.fn().mockRejectedValue(new Error("queue unreachable"));

    await expect(
      new QueueTransport({ provider: "queue", dispatch }).send(message),
    ).rejects.toThrow("queue unreachable");
  });
});
