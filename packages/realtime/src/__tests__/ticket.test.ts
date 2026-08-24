import { describe, expect, it } from "vitest";

import { signHmac, signTicket } from "../ticket";
import { verifyHmac, verifyTicket } from "../verify";

const SECRET = "test-secret-32-bytes-long-padding-pad";

describe("signTicket + verifyTicket", () => {
  it("round-trips a valid ticket", async () => {
    const ticket = await signTicket({
      subject: "c_123",
      roomId: "customer:c_123",
      secret: SECRET,
    });
    const sub = await verifyTicket(ticket.token, SECRET, "customer:c_123");
    expect(sub).toBe("c_123");
  });

  it("returns expiresAt approximately ttl seconds from now", async () => {
    const before = Date.now();
    const ticket = await signTicket({
      subject: "c_1",
      roomId: "customer:c_1",
      secret: SECRET,
      ttlSeconds: 60,
    });
    const expMs = new Date(ticket.expiresAt).getTime();
    expect(expMs - before).toBeGreaterThanOrEqual(58_000);
    expect(expMs - before).toBeLessThanOrEqual(62_000);
  });

  it("rejects when the secret is wrong", async () => {
    const ticket = await signTicket({
      subject: "c_1",
      roomId: "customer:c_1",
      secret: SECRET,
    });
    await expect(
      verifyTicket(ticket.token, "wrong-secret", "customer:c_1"),
    ).rejects.toThrow();
  });

  it("rejects when the room id doesn't match", async () => {
    const ticket = await signTicket({
      subject: "c_1",
      roomId: "customer:c_1",
      secret: SECRET,
    });
    await expect(
      verifyTicket(ticket.token, SECRET, "customer:c_OTHER"),
    ).rejects.toThrow(/room mismatch/);
  });

  it("rejects an expired ticket", async () => {
    const ticket = await signTicket({
      subject: "c_1",
      roomId: "customer:c_1",
      secret: SECRET,
      ttlSeconds: -1, // already expired
    });
    await expect(
      verifyTicket(ticket.token, SECRET, "customer:c_1"),
    ).rejects.toThrow();
  });

  it("requires a subject", async () => {
    await expect(
      signTicket({ subject: "", roomId: "customer:c", secret: SECRET }),
    ).rejects.toThrow(/subject/);
  });

  it("requires a secret", async () => {
    await expect(
      signTicket({ subject: "c_1", roomId: "customer:c_1", secret: "" }),
    ).rejects.toThrow(/secret/);
  });
});

describe("signHmac + verifyHmac", () => {
  it("round-trips a valid signature", async () => {
    const body = JSON.stringify({ event: "hello", data: { ts: 42 } });
    const signature = await signHmac(body, SECRET);
    await expect(verifyHmac(body, signature, SECRET)).resolves.toBeUndefined();
  });

  it("uses the hmac-sha256= prefix", async () => {
    const sig = await signHmac("body", SECRET);
    expect(sig.startsWith("hmac-sha256=")).toBe(true);
  });

  it("rejects when the body has been tampered with", async () => {
    const sig = await signHmac("original", SECRET);
    await expect(verifyHmac("tampered", sig, SECRET)).rejects.toThrow();
  });

  it("rejects when the secret is wrong", async () => {
    const sig = await signHmac("body", SECRET);
    await expect(verifyHmac("body", sig, "wrong-secret")).rejects.toThrow();
  });

  it("rejects a missing signature header", async () => {
    await expect(verifyHmac("body", null, SECRET)).rejects.toThrow(/missing/);
  });

  it("rejects an unknown signature scheme", async () => {
    await expect(
      verifyHmac("body", "md5=abc", SECRET),
    ).rejects.toThrow(/scheme/);
  });
});
