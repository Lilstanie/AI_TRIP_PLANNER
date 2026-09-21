import { describe, it, expect } from "vitest";
import { airportCodeFor, knownAirportCities } from "../src/airports";

describe("airportCodeFor", () => {
  it("resolves the cities this product actually plans for", () => {
    expect(airportCodeFor("Melbourne")).toBe("MEL");
    expect(airportCodeFor("Seoul")).toBe("ICN");
    expect(airportCodeFor("Sydney")).toBe("SYD");
  });

  it("is insensitive to case, spacing and punctuation", () => {
    for (const written of ["Hong Kong", "hong kong", "  HONG  KONG ", "hong-kong"])
      expect(airportCodeFor(written), written).toBe("HKG");
    expect(airportCodeFor("Ho Chi Minh City")).toBe("SGN");
  });

  it("passes through what a provider already accepts", () => {
    expect(airportCodeFor("SYD")).toBe("SYD");
    expect(airportCodeFor("/m/02_286")).toBe("/m/02_286");
  });

  it("returns nothing rather than guessing an unknown city", () => {
    // A wrong airport silently prices the wrong flight, and nothing downstream
    // would catch it — so an unmapped city has to stop the search.
    expect(airportCodeFor("Wagga Wagga")).toBeUndefined();
    expect(airportCodeFor("")).toBeUndefined();
    // Lowercase three-letter words are cities we lack, not codes.
    expect(airportCodeFor("syd")).toBeUndefined();
  });

  it("maps every city to a plausible IATA code", () => {
    const cities = knownAirportCities();
    expect(cities.length).toBeGreaterThan(80);
    for (const city of cities) {
      const code = airportCodeFor(city);
      expect(code, city).toMatch(/^[A-Z]{3}$/);
    }
  });
});
