import { describe, expect, it, vi } from "vitest";
import type { AgentContext, Place, PlaceQuery, TripBrief } from "@trip/shared";
import { createItineraryAgent, type ItineraryGenerator } from "../../src/itinerary";

const brief: TripBrief = {
  tripId: "packed-pace",
  intent: { pace: "packed" },
  userId: "traveller",
  destination: "Tokyo",
  dates: ["2026-12-10", "2026-12-12"],
  groupSize: 2,
  budgetTotal: 8000,
};

const sights: Place[] = Array.from({ length: 12 }, (_, index) => `Sight ${index + 1}`).map(
  (name) => ({
    name,
    category: "sight",
  }),
);
const restaurants: Place[] = [
  {
    name: "Ramen Ichi",
    category: "restaurant",
    placeId: "osm:node/1",
    location: { latitude: 35.7, longitude: 139.79 },
  },
  {
    name: "Sushi Ni",
    category: "restaurant",
    placeId: "osm:node/2",
    location: { latitude: 35.69, longitude: 139.7 },
  },
  {
    name: "Tempura San",
    category: "restaurant",
    placeId: "osm:node/3",
    location: { latitude: 35.68, longitude: 139.76 },
  },
];

function context(places: (q: PlaceQuery) => Promise<Place[]>): AgentContext {
  return {
    tripId: brief.tripId,
    round: 1,
    tools: {
      maps: {
        places: vi.fn(places),
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

const byCategory = async ({ category }: PlaceQuery) =>
  category === "sight" ? sights : category === "restaurant" ? restaurants : [];

const minutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour! * 60 + minute!;
};

describe("a packed pace the brief model recorded", () => {
  it("fills every day with four sights and both meals, each reachable from the stop before", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(byCategory),
    });

    for (const day of [1, 2, 3]) {
      const stops = result.items.filter((item) => item.day === day);
      const meals = stops.filter((item) =>
        restaurants.some((place) => place.name === item.location),
      );
      expect(stops.length - meals.length).toBe(4);
      expect(meals.map((item) => item.startTime)).toEqual(["12:45", "18:30"]);
      for (let index = 1; index < stops.length; index += 1)
        expect(
          minutes(stops[index]!.startTime) - minutes(stops[index - 1]!.endTime),
        ).toBeGreaterThanOrEqual(20 + 15);
    }
    expect(result.conflictsWith ?? []).toEqual([]);
  });
});
