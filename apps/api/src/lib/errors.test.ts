import { describe, expect, test } from "vitest";
import { ServiceError } from "@saas/services";
import { toHttpError } from "./errors";

describe("toHttpError", () => {
  /*
   * Services raise a code, not a status. Mapping it here is what lets the very
   * same service run behind a Server Action and inside a background job, where
   * an HTTP status would be meaningless.
   */

  test("maps a service code onto its status", () => {
    const response = toHttpError(new ServiceError({ code: "NOT_FOUND", message: "gone" }));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: "NOT_FOUND", message: "gone" });
  });

  test("never leaks an unexpected error's message to the caller", () => {
    const response = toHttpError(new Error("connect ECONNREFUSED 10.0.0.4:5432"));

    expect(response.status).toBe(500);
    expect(response.body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(response.body.message).not.toContain("10.0.0.4");
  });
});
