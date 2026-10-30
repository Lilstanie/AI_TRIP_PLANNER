import { describe, expect, it, vi } from "vitest";
import type { AgentContext, Place, TripBrief } from "@trip/shared";
import { createItineraryAgent, type ItineraryGenerator } from "../../src/itinerary";

const brief: TripBrief = {
  tripId: "stop-place-ids",
  userId: "traveller",
  destination: "Tokyo",
  dates: ["2026-12-10", "2026-12-11"],
  groupSize: 2,
  budgetTotal: 4000,
};

const found: Place[] = [
  {
    name: "Senso-ji",
    category: "sight",
    placeId: "osm:way/123",
    location: { latitude: 35.7148, longitude: 139.7967 },
  },
  { name: "Ueno Park", category: "sight", location: { latitude: 35.7156, longitude: 139.7745 } },
];

function context(): AgentContext {
  return {
    tripId: brief.tripId,
    round: 1,
    tools: {
      maps: {
        places: vi.fn(async ({ category }) => (category === "sight" ? found : [])),
        route: vi.fn(async () => [{ mode: "transit" as const, durationMin: 20, price: 3 }]),
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

const ids = (items: Array<{ location?: string; placeId?: string; savedPlace?: unknown }>) =>
  items.map(({ location, placeId, savedPlace }) => ({ location, placeId, savedPlace }));

describe("itinerary stops keep the place the tools found", () => {
  it("carries the tool's place id onto each fallback stop, and none onto a place without one", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(),
    });

    expect(ids(result.items)).toEqual([
      { location: "Senso-ji", placeId: "osm:way/123", savedPlace: undefined },
      { location: "Ueno Park", placeId: undefined, savedPlace: undefined },
    ]);
  });

  it("matches a model stop to its place despite case and spacing, and never lends an id to an unknown name", async () => {
    const generator: ItineraryGenerator = {
      generate: vi.fn(async () => ({
        summary: "Two days",
        activities: [
          {
            day: 1,
            startTime: "09:00",
            endTime: "11:00",
            location: " senso-JI ",
            detail: "Temple",
          },
          { day: 2, startTime: "09:00", endTime: "11:00", location: "Ueno Park", detail: "Park" },
        ],
        assumptions: [],
      })),
    };

    const result = await createItineraryAgent({ generator }).invoke({ brief, context: context() });

    expect(result.items.map((item) => item.placeId)).toEqual(["osm:way/123", undefined]);
  });
});
