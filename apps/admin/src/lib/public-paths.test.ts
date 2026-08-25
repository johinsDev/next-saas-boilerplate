import { describe, expect, test } from "vitest";

import { isPublic } from "./public-paths";

describe("isPublic", () => {
  test("lets the auth callbacks through", () => {
    /*
     * The one that matters. OAuth and magic-link callbacks arrive *before* a
     * cookie exists, so redirecting them means sign-in can never complete — and
     * the symptom is "Google is broken", not "the proxy is misconfigured".
     */
    expect(isPublic("/api/auth/callback/google")).toBe(true);
    expect(isPublic("/api/auth/magic-link/verify")).toBe(true);
  });

  test("lets the sign-in page through", () => {
    expect(isPublic("/sign-in")).toBe(true);
  });

  test("guards everything else", () => {
    expect(isPublic("/")).toBe(false);
    expect(isPublic("/dashboard")).toBe(false);
    expect(isPublic("/no-access")).toBe(false);
  });

  test("matches a path segment, not a prefix string", () => {
    // `/sign-in-elsewhere` is not the sign-in page, and an app that matched it
    // would be handing out an unguarded route for free.
    expect(isPublic("/sign-in-elsewhere")).toBe(false);
    expect(isPublic("/api/authorise")).toBe(false);
  });
});
