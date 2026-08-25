import { describe, expect, test, vi } from "vitest";

import { DeferredTransport } from "./deferred";
import type { EmailMessageData } from "../types";

const message = {
  to: ["someone@example.com"],
  subject: "Welcome",
  html: "<p>hi</p>",
} as unknown as EmailMessageData;

const deferred = (dispatch: ReturnType<typeof vi.fn>) =>
  new DeferredTransport({ mailer: "resend", dispatch });

describe("DeferredTransport", () => {
  test("hands the job to the queue instead of delivering it", async () => {
    const dispatch = vi.fn().mockResolvedValue({ id: "run_123" });

    await deferred(dispatch).send(message);

    // The mailer travels with the message: this process is not the one holding
    // Resend's credentials, so the destination has to be named, not resolved.
    expect(dispatch).toHaveBeenCalledWith({ mailer: "resend", message });
  });

  test("reports the real destination, not the queue", async () => {
    /*
     * The bug this design replaced: a `queue` provider reported
     * `provider: "queue"`, which is a lie — no provider had touched the message
     * yet, and every other transport names where the mail actually went.
     */
    const response = await deferred(vi.fn().mockResolvedValue({ id: "r" })).send(message);

    expect(response.provider).toBe("resend");
  });

  test("reports queued, never sent", async () => {
    // Nothing has reached a provider. Claiming `sent` would make a queued email
    // indistinguishable from a delivered one in logs and audit trails.
    const response = await deferred(vi.fn().mockResolvedValue({ id: "r" })).send(message);

    expect(response.status).toBe("queued");
  });

  test("carries the run id back, so a caller can follow the work", async () => {
    const response = await deferred(vi.fn().mockResolvedValue({ id: "run_abc" })).send(message);

    expect(response.providerMessageId).toBe("run_abc");
  });

  test("lets a dispatch failure through rather than swallowing it", async () => {
    // A queue that is down must not look like a delivered email.
    const dispatch = vi.fn().mockRejectedValue(new Error("queue unreachable"));

    await expect(deferred(dispatch).send(message)).rejects.toThrow("queue unreachable");
  });
});
