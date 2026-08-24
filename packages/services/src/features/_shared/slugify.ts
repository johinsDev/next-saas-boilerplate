/**
 * Turn a human label into a URL-safe slug: lowercased, accents stripped,
 * non-alphanumerics collapsed to single hyphens, trimmed. Shared across features
 * that need editable, human-readable slugs (the shortlinks slug is random base62
 * and not reusable here).
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** A short random suffix to disambiguate a colliding slug. */
export function slugSuffix(length = 5): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[(bytes[i] as number) % alphabet.length];
  }
  return out;
}
