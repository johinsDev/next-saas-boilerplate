import { describe, expect, it } from "vitest";

import {
  formatAddress,
  isAddressComplete,
  mapPlaceToStoreAddress,
  storeAddressSchema,
} from "./index";

describe("formatAddress", () => {
  it("joins present parts in order, skipping empties", () => {
    expect(
      formatAddress({
        line1: "Cra 13 #85-32",
        line2: "Local 2",
        city: "Bogotá",
        state: "Cundinamarca",
        country: "Colombia",
      }),
    ).toBe("Cra 13 #85-32, Local 2, Bogotá, Cundinamarca, Colombia");
  });

  it("handles missing optional parts (CO without postal)", () => {
    expect(formatAddress({ line1: "Cra 13 #85-32", city: "Bogotá" })).toBe("Cra 13 #85-32, Bogotá");
  });

  it("returns empty string for null", () => {
    expect(formatAddress(null)).toBe("");
  });
});

describe("isAddressComplete", () => {
  it("requires a non-empty line1", () => {
    expect(isAddressComplete({ line1: "x" })).toBe(true);
    expect(isAddressComplete({ line1: "  " })).toBe(false);
    expect(isAddressComplete(null)).toBe(false);
  });
});

describe("storeAddressSchema", () => {
  it("upper-cases countryCode and trims", () => {
    const parsed = storeAddressSchema.parse({ line1: " Cra 13 ", countryCode: "co" });
    expect(parsed.line1).toBe("Cra 13");
    expect(parsed.countryCode).toBe("CO");
  });

  it("rejects an empty line1", () => {
    expect(storeAddressSchema.safeParse({ line1: "" }).success).toBe(false);
  });
});

describe("mapPlaceToStoreAddress", () => {
  it("maps Google v1 components to structured parts", () => {
    const a = mapPlaceToStoreAddress({
      id: "abc",
      formattedAddress: "Cra. 13 #85-32, Bogotá, Colombia",
      location: { latitude: 4.67, longitude: -74.05 },
      addressComponents: [
        { longText: "85-32", types: ["street_number"] },
        { longText: "Carrera 13", types: ["route"] },
        { longText: "Bogotá", types: ["locality"] },
        { longText: "Bogotá D.C.", types: ["administrative_area_level_1"] },
        { longText: "Colombia", shortText: "CO", types: ["country"] },
      ],
    });
    expect(a.line1).toBe("85-32 Carrera 13");
    expect(a.city).toBe("Bogotá");
    expect(a.state).toBe("Bogotá D.C.");
    expect(a.country).toBe("Colombia");
    expect(a.countryCode).toBe("CO");
    expect(a.lat).toBe(4.67);
    expect(a.lng).toBe(-74.05);
    expect(a.placeId).toBe("abc");
    expect(a.formatted).toBe("Cra. 13 #85-32, Bogotá, Colombia");
  });

  it("falls back to the formatted address for line1 when no street parts", () => {
    const a = mapPlaceToStoreAddress({
      formattedAddress: "Acme Lovers, Bogotá",
      addressComponents: [{ longText: "Bogotá", types: ["locality"] }],
    });
    expect(a.line1).toBe("Acme Lovers");
  });
});
