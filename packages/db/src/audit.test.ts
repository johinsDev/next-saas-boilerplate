import { describe, expect, it, vi } from "vitest";

import { recordAudit } from "./audit";
import type { Database } from "./client";

function fakeDb(onInsert: (values: unknown) => void | Promise<void>): Database {
  return {
    insert: () => ({
      values: async (v: unknown) => {
        await onInsert(v);
      },
    }),
  } as unknown as Database;
}

describe("recordAudit", () => {
  it("writes the entry, normalising absent fields to null", async () => {
    let written: Record<string, unknown> | undefined;
    await recordAudit(
      fakeDb((v) => {
        written = v as Record<string, unknown>;
      }),
      { type: "login", actorUserId: "u_1" },
    );

    expect(written).toMatchObject({
      type: "login",
      actorUserId: "u_1",
      organizationId: null,
      targetUserId: null,
      metadata: null,
      ip: null,
      userAgent: null,
    });
  });

  // Auditing must never break the thing it audits. A login that succeeds and
  // then throws because the trail could not be appended is strictly worse than
  // a missing row.
  it("swallows a failing insert", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordAudit(
        fakeDb(() => {
          throw new Error("db is down");
        }),
        { type: "login" },
      ),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
