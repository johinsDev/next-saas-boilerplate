import { describe, expect, test } from "vitest";

import { signInSchema } from "./sign-in-form";

/**
 * The schema is the single source of truth for this form, so it is the thing
 * worth pinning down — the rendering can be looked at, but "what counts as a
 * valid address, and what do we say when it is not" should not drift silently.
 */

const messageFor = (email: string) => {
  const result = signInSchema.safeParse({ email });
  return result.success ? null : result.error.issues[0]?.message;
};

describe("signInSchema", () => {
  test("accepts an ordinary address", () => {
    expect(signInSchema.safeParse({ email: "someone@example.com" }).success).toBe(true);
  });

  test("asks for something rather than complaining about the shape when empty", () => {
    /*
     * Order matters. `.email()` on an empty string reports "invalid email",
     * which reads as an accusation about something the visitor has not typed
     * yet. The `.min(1)` runs first so an empty field gets the invitation.
     */
    expect(messageFor("")).toBe("Enter the email you signed up with.");
  });

  test("rejects a string that is not an address", () => {
    expect(messageFor("johan")).toBe("That does not look like an email address.");
    expect(messageFor("johan@")).toBe("That does not look like an email address.");
    expect(messageFor("@intrigo.game")).toBe("That does not look like an email address.");
  });

  test("trims a pasted address rather than rejecting it", () => {
    /*
     * Copying an address out of a chat window brings a space with it. Refusing
     * that is pedantry the visitor has to debug, and the old hand-rolled form
     * trimmed anyway — it just did it *after* validating, so what it checked
     * and what it sent were different strings.
     */
    const result = signInSchema.safeParse({ email: "  someone@example.com  " });

    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe("someone@example.com");
  });
});
