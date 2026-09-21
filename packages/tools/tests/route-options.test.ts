import { describe, it, expect } from "vitest";
import {
  driveOption,
  transitOption,
  transitVehicles,
  moneyFrom,
  minutesFrom,
} from "../src/route-options";

const q = { from: "Parramatta", to: "Sydney CBD", date: "2026-11-25", day: 1, localTime: "09:00" };

describe("moneyFrom", () => {
  it("reads Google's units-and-nanos money", () => {
    // The shape a real Sydney toll route came back with.
    expect(moneyFrom({ currencyCode: "AUD", units: "13", nanos: 290000000 })).toBe(13.29);
    expect(moneyFrom({ currencyCode: "AUD", units: "4" })).toBe(4);
    // An empty object is what Google sends when it has no fare to give.
    expect(moneyFrom({})).toBeUndefined();
    expect(moneyFrom(undefined)).toBeUndefined();
  });
});

describe("minutesFrom", () => {
  it("accepts only the duration format Google documents", () => {
    expect(minutesFrom("3340s")).toBe(56);
    expect(minutesFrom("30s")).toBe(1);
    for (const bad of ["3340", "abc", "0s", "-5s", undefined])
      expect(minutesFrom(bad as string | undefined), String(bad)).toBeUndefined();
  });
});

describe("transitVehicles", () => {
  it("names the vehicles a route actually uses, without repeats", () => {
    const vehicles = transitVehicles({
      legs: [
        {
          steps: [
            { travelMode: "WALK" },
            {
              travelMode: "TRANSIT",
              transitDetails: {
                transitLine: { nameShort: "333", vehicle: { type: "BUS" } },
              },
            },
            {
              travelMode: "TRANSIT",
              transitDetails: {
                transitLine: { nameShort: "333", vehicle: { type: "BUS" } },
              },
            },
            {
              travelMode: "TRANSIT",
              transitDetails: { transitLine: { name: "T1", vehicle: { type: "HEAVY_RAIL" } } },
            },
          ],
        },
      ],
    });
    expect(vehicles).toEqual([
      { mode: "bus", line: "333" },
      { mode: "train", line: "T1" },
    ]);
  });
});

describe("driveOption", () => {
  it("counts real tolls and says what it still cannot price", () => {
    const option = driveOption(
      {
        duration: "1740s",
        distanceMeters: 25590,
        travelAdvisory: {
          tollInfo: { estimatedPrice: [{ currencyCode: "AUD", units: "13", nanos: 290000000 }] },
        },
      },
      q,
    )!;
    expect(option).toMatchObject({ mode: "drive", durationMin: 29, price: 13.29 });
    // Tolls are real, but fuel and parking are not quoted, so the cost is partial.
    expect(option.priceBasis).toBe("partial");
    expect(option.note).toMatch(/tolls A\$13\.29/);
    expect(option.note).toMatch(/fuel, parking/);
  });

  it("stays partial on a toll-free road rather than claiming the trip is free", () => {
    const option = driveOption({ duration: "1100s", distanceMeters: 8323, travelAdvisory: {} }, q)!;
    expect(option.price).toBe(0);
    expect(option.priceBasis).toBe("partial");
    expect(option.note).toMatch(/no tolls/);
  });
});

describe("transitOption", () => {
  it("marks an unpublished fare unavailable, not free", () => {
    // Australia returns an empty transitFare, which is the case that matters:
    // treating it as $0 would make the bus win every budget comparison.
    const option = transitOption(
      {
        duration: "3340s",
        distanceMeters: 10206,
        travelAdvisory: { transitFare: {} },
        legs: [
          {
            steps: [
              {
                travelMode: "TRANSIT",
                transitDetails: { transitLine: { nameShort: "333", vehicle: { type: "BUS" } } },
              },
            ],
          },
        ],
      },
      q,
    )!;
    expect(option.mode).toBe("bus");
    expect(option.price).toBe(0);
    expect(option.priceBasis).toBe("unavailable");
    expect(option.note).toMatch(/via bus 333/);
    expect(option.note).toMatch(/fare not published/);
  });

  it("reports a published fare as complete", () => {
    const option = transitOption(
      {
        duration: "600s",
        travelAdvisory: { transitFare: { currencyCode: "AUD", units: "4", nanos: 500000000 } },
        legs: [
          {
            steps: [
              {
                travelMode: "TRANSIT",
                transitDetails: { transitLine: { name: "T1", vehicle: { type: "SUBWAY" } } },
              },
            ],
          },
        ],
      },
      q,
    )!;
    expect(option).toMatchObject({ mode: "train", price: 4.5, priceBasis: "complete" });
  });

  it("stays generic when a journey mixes vehicles", () => {
    const option = transitOption(
      {
        duration: "900s",
        legs: [
          {
            steps: [
              {
                travelMode: "TRANSIT",
                transitDetails: { transitLine: { nameShort: "333", vehicle: { type: "BUS" } } },
              },
              {
                travelMode: "TRANSIT",
                transitDetails: { transitLine: { name: "T1", vehicle: { type: "HEAVY_RAIL" } } },
              },
            ],
          },
        ],
      },
      q,
    )!;
    expect(option.mode).toBe("transit");
    expect(option.note).toMatch(/via bus 333, train T1/);
  });
});
