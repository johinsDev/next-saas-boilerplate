import { describe, expect, it } from "vitest";

// The PartyKit server carries its own copy of verifyTicket (it deploys to
// workerd from its own project and does not depend on this package). Both are
// exercised here so the two cannot drift on the rule that matters.
import { verifyTicket as verifyTicketInParty } from "../../../../partykit/src/parties/_shared/auth";
import { signHmac, signTicket } from "../ticket";
import { verifyHmac, verifyTicket } from "../verify";

const SECRET = "test-secret-32-bytes-long-padding-pad";

describe("signTicket + verifyTicket", () => {
  it("round-trips a valid ticket", async () => {
    const ticket = await signTicket({
      subject: "u_123",
      roomId: "user:u_123",
      secret: SECRET,
    });
    const sub = await verifyTicket(ticket.token, SECRET, "user:u_123");
    expect(sub).toBe("u_123");
  });

  it("returns expiresAt approximately ttl seconds from now", async () => {
    const before = Date.now();
    const ticket = await signTicket({
      subject: "u_1",
      roomId: "user:u_1",
      secret: SECRET,
      ttlSeconds: 60,
    });
    const expMs = new Date(ticket.expiresAt).getTime();
    expect(expMs - before).toBeGreaterThanOrEqual(58_000);
    expect(expMs - before).toBeLessThanOrEqual(62_000);
  });

  it("rejects when the secret is wrong", async () => {
    const ticket = await signTicket({
      subject: "u_1",
      roomId: "user:u_1",
      secret: SECRET,
    });
    await expect(
      verifyTicket(ticket.token, "wrong-secret", "user:u_1"),
    ).rejects.toThrow();
  });

  it("rejects when the room id doesn't match", async () => {
    const ticket = await signTicket({
      subject: "u_1",
      roomId: "user:u_1",
      secret: SECRET,
    });
    await expect(
      verifyTicket(ticket.token, SECRET, "user:u_OTHER"),
    ).rejects.toThrow(/room mismatch/);
  });

  it("rejects an expired ticket", async () => {
    const ticket = await signTicket({
      subject: "u_1",
      roomId: "user:u_1",
      secret: SECRET,
      ttlSeconds: -1, // already expired
    });
    await expect(
      verifyTicket(ticket.token, SECRET, "user:u_1"),
    ).rejects.toThrow();
  });

  it("requires a subject", async () => {
    await expect(
      signTicket({ subject: "", roomId: "user:u_1", secret: SECRET }),
    ).rejects.toThrow(/subject/);
  });

  it("requires a secret", async () => {
    await expect(
      signTicket({ subject: "u_1", roomId: "user:u_1", secret: "" }),
    ).rejects.toThrow(/secret/);
  });

  it("rejects a room whose kind has no party", async () => {
    await expect(
      signTicket({ subject: "c_1", roomId: "customer:c_1" as never, secret: SECRET }),
    ).rejects.toThrow(/unknown party kind/);
  });

  it("signs an organization ticket for a subject that is not the room", async () => {
    // Membership can't be checked in this package, so an operator's user id is
    // a legitimate subject for an org room. The check below is user-rooms-only
    // on purpose, and this pins that.
    const ticket = await signTicket({
      subject: "u_staff",
      roomId: "organization:o_1",
      secret: SECRET,
    });
    await expect(
      verifyTicket(ticket.token, SECRET, "organization:o_1"),
    ).resolves.toBe("u_staff");
  });
});

describe("a user room belongs to its user", () => {
  it("refuses to mint a ticket for someone else's user room", async () => {
    await expect(
      signTicket({
        subject: "u_attacker",
        roomId: "user:u_victim",
        secret: SECRET,
      }),
    ).rejects.toThrow(/may only be granted to its own user/);
  });

  // The party is the enforcement point: a caller that goes around signTicket
  // and mints its own JWT still must not get in. Forge one directly.
  it("refuses to accept a validly signed ticket naming another user", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(SECRET);
    const forged = await new SignJWT({ room: "user:u_victim" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u_attacker")
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 300)
      .sign(key);

    // The signature is good and the room matches — only the subject is wrong.
    await expect(
      verifyTicket(forged, SECRET, "user:u_victim"),
    ).rejects.toThrow(/does not own this user room/);

    // And the same forgery must fail against the copy the party actually runs.
    await expect(
      verifyTicketInParty(forged, SECRET, "user:u_victim"),
    ).rejects.toThrow(/does not own this user room/);
  });

  it("accepts the owner's own ticket in both implementations", async () => {
    const ticket = await signTicket({
      subject: "u_owner",
      roomId: "user:u_owner",
      secret: SECRET,
    });
    await expect(verifyTicket(ticket.token, SECRET, "user:u_owner")).resolves.toBe(
      "u_owner",
    );
    await expect(
      verifyTicketInParty(ticket.token, SECRET, "user:u_owner"),
    ).resolves.toBe("u_owner");
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
