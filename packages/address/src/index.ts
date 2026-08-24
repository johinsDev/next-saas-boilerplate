import { z } from "zod";

/**
 * `@saas/address` — the structured store address shared across the stack.
 *
 * Pure TS (no React, no fetch, no server deps) so every layer can import it:
 * `@saas/ui` (the field + customer preview), `@saas/api` (persist +
 * denormalize the formatted string), and the apps. The provider-specific
 * "how do I search addresses" lives in `@saas/ui` (a swappable
 * `AddressProvider`), not here — this package only owns the SHAPE + formatting.
 */

/**
 * A structured postal address + geocoordinates. Generic/international so it
 * works in Colombia today (where `postalCode` is rarely used) and scales to a
 * multi-country SaaS without a migration. `line2` carries the local / interior
 * / building reference. `lat`/`lng` drive the Static Maps screenshot and the
 * customer map; they're optional so a manual entry (no Google key) still saves.
 */
export const storeAddressSchema = z.object({
  /** Street line, e.g. "Cra 13 #85-32". */
  line1: z.string().trim().min(1).max(200),
  /** Local / edificio / interior / referencia (optional). */
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  /** State / province / department / region. */
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(40).optional(),
  country: z.string().trim().max(120).optional(),
  /** ISO 3166-1 alpha-2, e.g. "CO". */
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  /** Google Places id (when the address came from autocomplete). */
  placeId: z.string().max(300).optional(),
  /** Denormalized single-line form; recomputed from the parts on save. */
  formatted: z.string().max(400).optional(),
});

export type StoreAddress = z.infer<typeof storeAddressSchema>;

const FORMAT_ORDER: (keyof StoreAddress)[] = [
  "line1",
  "line2",
  "city",
  "state",
  "postalCode",
  "country",
];

/**
 * Single-line, locale-neutral rendering of the address parts — empties skipped,
 * joined by ", ". Used for the denormalized `store.address` (BE) and the
 * customer-facing display / preview (UI). Deterministic + side-effect free.
 */
export function formatAddress(a: Partial<StoreAddress> | null | undefined): string {
  if (!a) return "";
  return FORMAT_ORDER.map((k) => {
    const v = a[k];
    return typeof v === "string" ? v.trim() : "";
  })
    .filter((v) => v.length > 0)
    .join(", ");
}

/** Has enough to be persisted/displayed (a street line at minimum). */
export function isAddressComplete(a: Partial<StoreAddress> | null | undefined): a is StoreAddress {
  return Boolean(a && typeof a.line1 === "string" && a.line1.trim().length > 0);
}

// ── Google Places (v1) mapping ────────────────────────────────────────────────
// Minimal shapes for the `places.googleapis.com/v1` Place Details response we
// request (FieldMask: id,formattedAddress,location,addressComponents). Typed
// locally so this package stays dependency-free.

export interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

export interface GooglePlace {
  id?: string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: GoogleAddressComponent[];
}

function pick(components: GoogleAddressComponent[], type: string): GoogleAddressComponent | undefined {
  return components.find((c) => c.types?.includes(type));
}

/**
 * Map a Google Places v1 `Place` into our `StoreAddress`. `line1` prefers
 * street_number + route, falling back to the first segment of the formatted
 * address (common in CO, where Google often returns the whole street in one
 * field). City falls back across locality → admin level 2 → admin level 1.
 */
export function mapPlaceToStoreAddress(place: GooglePlace): StoreAddress {
  const components = place.addressComponents ?? [];
  const streetNumber = pick(components, "street_number")?.longText;
  const route = pick(components, "route")?.longText;
  const line1 =
    [streetNumber, route].filter(Boolean).join(" ").trim() ||
    place.formattedAddress?.split(",")[0]?.trim() ||
    place.formattedAddress?.trim() ||
    "";

  const subpremise = pick(components, "subpremise")?.longText;
  const city =
    pick(components, "locality")?.longText ??
    pick(components, "postal_town")?.longText ??
    pick(components, "administrative_area_level_2")?.longText ??
    pick(components, "administrative_area_level_1")?.longText;
  const state = pick(components, "administrative_area_level_1")?.longText;
  const postalCode = pick(components, "postal_code")?.longText;
  const countryComp = pick(components, "country");

  const parts: StoreAddress = {
    line1,
    ...(subpremise ? { line2: subpremise } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(postalCode ? { postalCode } : {}),
    ...(countryComp?.longText ? { country: countryComp.longText } : {}),
    ...(countryComp?.shortText ? { countryCode: countryComp.shortText.toUpperCase() } : {}),
    ...(place.location?.latitude != null ? { lat: place.location.latitude } : {}),
    ...(place.location?.longitude != null ? { lng: place.location.longitude } : {}),
    ...(place.id ? { placeId: place.id } : {}),
  };

  return { ...parts, formatted: place.formattedAddress?.trim() || formatAddress(parts) };
}
