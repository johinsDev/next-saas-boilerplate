// URL-safe base62 alphabet (no look-alike stripping — short links aren't
// hand-typed). `crypto.getRandomValues` is global on Node 20+ and workerd.
const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * A random base62 slug. 7 chars ≈ 3.5e12 space — collisions are
 * negligible at our volume, and the caller retries on the unique
 * constraint anyway. Modulo bias across 62/256 is irrelevant here.
 */
export function generateSlug(length = 7): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[(bytes[i] as number) % 62];
  }
  return out;
}

/** Slugs allowed for custom (manual) creation: base62, 1–64 chars. */
export function isValidSlug(slug: string): boolean {
  return /^[0-9A-Za-z]{1,64}$/.test(slug);
}
