import { describe, expect, it, vi } from "vitest";
import type { AgentContext, Place, RouteLeg, TripBrief } from "@trip/shared";
import { createItineraryAgent, type ItineraryGenerator } from "../../src/itinerary";
import { routeProblem } from "../../src/transport/validation";

const brief: TripBrief = {
  tripId: "driving-estimate-hops",
  userId: "traveller",
  destination: "Tokyo",
  dates: ["2026-12-10", "2026-12-11"],
  groupSize: 2,
  budgetTotal: 8000,
};

const found: Place[] = ["Senso-ji", "Ueno Park", "Tokyo Tower"].map((name) => ({
  name,
  category: "sight",
}));

const osrm = (durationMin: number): RouteLeg => ({
  mode: "transit",
  durationMin,
  price: 0,
  note: "OSRM driving-only estimate, not verified public transport; 4200m; fare unavailable",
});

const transit: RouteLeg = { mode: "transit", durationMin: 20, price: 3, note: "Tokyo Metro" };

function context(route: () => RouteLeg[]): AgentContext {
  return {
    tripId: brief.tripId,
    round: 1,
    tools: {
      maps: {
        places: vi.fn(async ({ category }) => (category === "sight" ? found : [])),
        route: vi.fn(async () => route()),
      },
      booking: { searchStays: vi.fn(async () => []), searchFlights: vi.fn(async () => []) },
    },
    mem: {
      getLongTerm: vi.fn(async () => []),
      getShortTerm: vi.fn(async () => []),
      appendShortTerm: vi.fn(async () => {}),
      setLongTerm: vi.fn(async () => {}),
      promote: vi.fn(async () => {}),
    },
  };
}

const generator: ItineraryGenerator = {
  generate: vi.fn(async () => ({
    summary: "Two days",
    activities: [
      { day: 1, startTime: "09:30", endTime: "11:30", location: "Senso-ji", detail: "Temple" },
      { day: 1, startTime: "12:15", endTime: "13:45", location: "Ueno Park", detail: "Park" },
      { day: 1, startTime: "14:30", endTime: "16:30", location: "Tokyo Tower", detail: "View" },
      { day: 2, startTime: "10:00", endTime: "12:00", location: "Senso-ji", detail: "Temple" },
    ],
    assumptions: [],
  })),
};

const ESTIMATE_NOTE = /driving estimates; public transport was not checked/;

describe("driving estimates between itinerary stops", () => {
  it("times each hop by its driving estimate instead of reporting it as a conflict, and says so once", async () => {
    const result = await createItineraryAgent({ generator }).invoke({
      brief,
      context: context(() => [osrm(18)]),
    });

    expect(result.conflictsWith).toEqual([]);
    expect(result.source?.kind).not.toBe("fallback");
    expect(result.items.map((item) => item.location)).toEqual([
      "Senso-ji",
      "Ueno Park",
      "Tokyo Tower",
      "Senso-ji",
    ]);
    expect(result.items[1]!.arriveBy?.durationMin).toBe(18);
    expect(result.assumptions.filter((line) => ESTIMATE_NOTE.test(line))).toHaveLength(1);
  });

  it("still reports a hop whose estimate and buffer do not fit between the stops", async () => {
    const result = await createItineraryAgent({ generator }).invoke({
      brief,
      context: context(() => [osrm(40)]),
    });

    expect(result.conflictsWith).toEqual([
      "geography conflict on day 1: Senso-ji to Ueno Park needs 55 minutes including a 15-minute buffer but only 45 are available",
      "geography conflict on day 1: Ueno Park to Tokyo Tower needs 55 minutes including a 15-minute buffer but only 45 are available",
    ]);
  });

  it("leaves the note out when every hop has a public transport route", async () => {
    const result = await createItineraryAgent({ generator }).invoke({
      brief,
      context: context(() => [transit]),
    });

    expect(result.conflictsWith).toEqual([]);
    expect(result.assumptions.some((line) => ESTIMATE_NOTE.test(line))).toBe(false);
  });

  it("keeps rejecting a driving estimate for a hop between cities", () => {
    expect(routeProblem([osrm(150)])).toBe(
      "driving estimate cannot verify public transport timing",
    );
  });
});
