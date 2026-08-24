import { describe, expect, it } from "vitest";

import { InvalidTokenError } from "../errors";
import { signStorageToken, verifyStorageToken } from "../token";

const SECRET = "test-secret-32-bytes-long-padding-pad";

describe("signStorageToken + verifyStorageToken", () => {
  it("round-trips a valid put token", async () => {
    const { token } = await signStorageToken({
      key: "avatars/lucia.png",
      disk: "default",
      mode: "put",
      contentType: "image/png",
      maxSize: 5_000_000,
      secret: SECRET,
    });
    const payload = await verifyStorageToken({
      token,
      secret: SECRET,
      expectedMode: "put",
    });
    expect(payload.key).toBe("avatars/lucia.png");
    expect(payload.disk).toBe("default");
    expect(payload.mode).toBe("put");
    expect(payload.contentType).toBe("image/png");
    expect(payload.maxSize).toBe(5_000_000);
  });

  it("round-trips a valid get token", async () => {
    const { token } = await signStorageToken({
      key: "docs/file.pdf",
      disk: "default",
      mode: "get",
      secret: SECRET,
    });
    const payload = await verifyStorageToken({
      token,
      secret: SECRET,
      expectedMode: "get",
    });
    expect(payload.mode).toBe("get");
  });

  it("rejects when the secret is wrong", async () => {
    const { token } = await signStorageToken({
      key: "k",
      disk: "d",
      mode: "put",
      secret: SECRET,
    });
    await expect(
      verifyStorageToken({ token, secret: "wrong-secret", expectedMode: "put" }),
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejects when mode mismatches", async () => {
    const { token } = await signStorageToken({
      key: "k",
      disk: "d",
      mode: "put",
      secret: SECRET,
    });
    await expect(
      verifyStorageToken({ token, secret: SECRET, expectedMode: "get" }),
    ).rejects.toThrow(/mode/);
  });

  it("rejects expired tokens", async () => {
    const { token } = await signStorageToken({
      key: "k",
      disk: "d",
      mode: "put",
      secret: SECRET,
      ttlSeconds: -1,
    });
    await expect(
      verifyStorageToken({ token, secret: SECRET, expectedMode: "put" }),
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("requires a secret", async () => {
    await expect(
      signStorageToken({ key: "k", disk: "d", mode: "put", secret: "" }),
    ).rejects.toThrow(/secret/);
  });

  it("includes expiresAt in ISO string form", async () => {
    const { expiresAt } = await signStorageToken({
      key: "k",
      disk: "d",
      mode: "put",
      secret: SECRET,
      ttlSeconds: 120,
    });
    expect(() => new Date(expiresAt).toISOString()).not.toThrow();
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
