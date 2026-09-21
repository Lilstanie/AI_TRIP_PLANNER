import { describe, it, expect } from "vitest";
import { journeyLegs, legMode, flightLegs, groundLegs } from "../../src/transport/legs";

const base = { start: "2026-10-01", days: 4 };

describe("journeyLegs", () => {
  it("flies the hop that reaches the destination from somewhere else", () => {
    const legs = journeyLegs({ ...base, origin: "Melbourne", destinations: ["Sydney"] });
    expect(legs).toEqual([
      { index: 0, from: "Melbourne", to: "Sydney", date: "2026-10-01", day: 1, mode: "flight" },
    ]);
  });

  it("plans an arrival transfer instead when the trip starts where it ends", () => {
    const legs = journeyLegs({ ...base, origin: "Sydney", destinations: ["Sydney"] });
    expect(legs).toEqual([
      {
        index: 0,
        from: "Sydney airport",
        to: "Sydney",
        date: "2026-10-01",
        day: 1,
        mode: "ground",
      },
    ]);
    expect(flightLegs(legs)).toHaveLength(0);
  });

  it("chains every city in travel order", () => {
    // The shape this module exists for: A → B → C → D.
    const legs = journeyLegs({
      ...base,
      days: 8,
      origin: "Melbourne",
      destinations: ["Tokyo", "Kyoto", "Osaka"],
    });
    expect(legs.map((leg) => `${leg.from} → ${leg.to}`)).toEqual([
      "Melbourne → Tokyo",
      "Tokyo → Kyoto",
      "Kyoto → Osaka",
    ]);
    expect(legs.map((leg) => leg.index)).toEqual([0, 1, 2]);
    // Hops move forward in time and never run past the trip.
    const days = legs.map((leg) => leg.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(Math.max(...days)).toBeLessThanOrEqual(8);
  });

  it("drops the airport transfer once there is real travel to plan", () => {
    const legs = journeyLegs({ ...base, origin: "Tokyo", destinations: ["Tokyo", "Kyoto"] });
    expect(legs.map((leg) => `${leg.from} → ${leg.to}`)).toEqual(["Tokyo → Kyoto"]);
  });

  it("rejects a journey with nowhere to go", () => {
    expect(() => journeyLegs({ ...base, origin: "Perth", destinations: [] })).toThrow();
  });
});

describe("legMode", () => {
  it("flies only the first hop today, and only when it leaves somewhere else", () => {
    expect(legMode(0, "Melbourne", "Sydney")).toBe("flight");
    expect(legMode(0, "Sydney", "sydney")).toBe("ground");
    // Changing this line is what turns on B→C and C→D flights.
    expect(legMode(1, "Tokyo", "Kyoto")).toBe("ground");
  });

  it("splits a journey into the two provider groups", () => {
    const legs = journeyLegs({
      ...base,
      days: 8,
      origin: "Perth",
      destinations: ["Tokyo", "Kyoto"],
    });
    expect(flightLegs(legs).map((l) => l.to)).toEqual(["Tokyo"]);
    expect(groundLegs(legs).map((l) => l.to)).toEqual(["Kyoto"]);
  });
});
