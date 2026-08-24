import { mapPlaceToStoreAddress, type StoreAddress } from "@saas/address";

/**
 * Swappable address-search backend for {@link AddressField}. The field is pure
 * UI and knows nothing about Google — it just calls `search` / `getDetails`.
 * Ship `createGooglePlacesProvider` today; pass a different `AddressProvider`
 * (e.g. an own geocoder) tomorrow without touching the component.
 */
export interface AddressSuggestion {
  /** Opaque provider id passed back to `getDetails`. */
  id: string;
  /** Full one-line description (fallback display). */
  description: string;
  /** Primary line (street), when the provider splits it. */
  primary: string;
  /** Secondary line (city/region), when available. */
  secondary?: string;
}

export interface AddressProvider {
  search(query: string, opts?: { signal?: AbortSignal }): Promise<AddressSuggestion[]>;
  getDetails(id: string): Promise<StoreAddress>;
}

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places/";

interface PlacePrediction {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
}

/** Google Places (v1) backed provider. Uses the referrer-restricted browser
 *  key; `getDetails` resolves the structured parts + lat/lng via Place Details. */
export function createGooglePlacesProvider(opts: { apiKey: string }): AddressProvider {
  const { apiKey } = opts;
  return {
    async search(query, o) {
      const res = await fetch(AUTOCOMPLETE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
        body: JSON.stringify({ input: query }),
        ...(o?.signal ? { signal: o.signal } : {}),
      });
      const data = (await res.json()) as { suggestions?: PlacePrediction[] };
      return (data.suggestions ?? []).flatMap((s): AddressSuggestion[] => {
        const p = s.placePrediction;
        const id = p?.placeId;
        const description = p?.text?.text ?? "";
        if (!id || !description) return [];
        const secondary = p?.structuredFormat?.secondaryText?.text;
        return [
          {
            id,
            description,
            primary: p?.structuredFormat?.mainText?.text ?? description,
            ...(secondary ? { secondary } : {}),
          },
        ];
      });
    },
    async getDetails(id) {
      const res = await fetch(`${DETAILS_URL}${id}`, {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
        },
      });
      const place = await res.json();
      return mapPlaceToStoreAddress(place);
    },
  };
}
