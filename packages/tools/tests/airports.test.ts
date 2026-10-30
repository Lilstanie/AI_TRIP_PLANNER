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

  it("resolves Chinese city names, simplified and traditional, as travellers write them", () => {
    expect(airportCodeFor("悉尼")).toBe("SYD");
    expect(airportCodeFor("雪梨")).toBe("SYD");
    expect(airportCodeFor("东京")).toBe("NRT");
    expect(airportCodeFor("東京")).toBe("NRT");
    expect(airportCodeFor(" 东京 ")).toBe("NRT");
    expect(airportCodeFor("京都")).toBe("KIX");
    expect(airportCodeFor("香港")).toBe("HKG");
    expect(airportCodeFor("墨尔本")).toBe("MEL");
    expect(airportCodeFor("首尔")).toBe("ICN");
  });

  it("ignores a trailing 市 on a Chinese city name", () => {
    expect(airportCodeFor("东京市")).toBe("NRT");
    expect(airportCodeFor("上海市")).toBe("PVG");
  });

  it("gives every city a Chinese name", () => {
    const cities = knownAirportCities();
    const codes = new Set(cities.filter((c) => /^[a-z ]+$/.test(c)).map((c) => airportCodeFor(c)));
    const zhCodes = new Set(
      cities.filter((c) => /\p{Script=Han}/u.test(c)).map((c) => airportCodeFor(c)),
    );
    expect([...codes].filter((code) => !zhCodes.has(code))).toEqual([]);
  });

  it("passes through what a provider already accepts", () => {
    expect(airportCodeFor("SYD")).toBe("SYD");
    expect(airportCodeFor("/m/02_286")).toBe("/m/02_286");
  });

  it("returns nothing rather than guessing an unknown city", () => {
    expect(airportCodeFor("Wagga Wagga")).toBeUndefined();
    expect(airportCodeFor("")).toBeUndefined();

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
