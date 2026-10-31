import { describe, expect, it, vi } from "vitest";
import type { AgentContext, Place, PlaceQuery, TripBrief } from "@trip/shared";
import { createItineraryAgent, type ItineraryGenerator } from "../../src/itinerary";

const brief: TripBrief = {
  tripId: "meals-in-day-plan",
  userId: "traveller",
  destination: "Tokyo",
  dates: ["2026-12-10", "2026-12-12"],
  groupSize: 2,
  budgetTotal: 8000,
};

const sights: Place[] = ["Senso-ji", "Meiji Jingu", "Ueno Park", "Tokyo Tower"].map((name) => ({
  name,
  category: "sight",
}));
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

describe("found restaurants reach the day plan", () => {
  it("gives each day one meal at a different found restaurant, between sights, with its map pin", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(byCategory),
    });

    const meals = result.items.filter((item) =>
      restaurants.some((place) => place.name === item.location),
    );
    expect(meals.map((item) => item.day)).toEqual([1, 2, 3]);
    expect(new Set(meals.map((item) => item.location)).size).toBe(3);
    expect(meals.every((item) => item.placeId?.startsWith("osm:node/"))).toBe(true);
    expect(meals[0]!.detail).not.toContain("suggested stop");
    for (const day of [1, 2, 3]) {
      const onDay = result.items
        .filter((item) => item.day === day)
        .sort((a, b) => minutes(a.startTime!) - minutes(b.startTime!));
      expect(
        onDay.filter((item) => sights.some((place) => place.name === item.location)).length,
      ).toBeGreaterThan(0);
      for (let index = 1; index < onDay.length; index += 1)
        expect(minutes(onDay[index]!.startTime!)).toBeGreaterThanOrEqual(
          minutes(onDay[index - 1]!.endTime!),
        );
    }
  });

  it("keeps the sights and reports the gap when the restaurant lookup fails", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(async (q) => {
        if (q.category === "restaurant") throw new Error("Geoapify down");
        return byCategory(q);
      }),
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => sights.some((place) => place.name === item.location))).toBe(
      true,
    );
    expect(result.assumptions.join("\n")).toContain(
      "Place provider unavailable for restaurant in Tokyo",
    );
  });

  it("asks for restaurants that meet a dietary requirement", async () => {
    const ctx = context(byCategory);
    await createItineraryAgent({ generator: false }).invoke({
      brief: { ...brief, preferences: ["vegetarian"] },
      context: ctx,
    });

    const query = vi
      .mocked(ctx.tools.maps.places)
      .mock.calls.map(([q]) => q)
      .find((q) => q.category === "restaurant");
    expect(query?.textQuery).toContain("vegetarian");
  });

  it("lists restaurants for the model and rejects one it made up", async () => {
    const draft = (location: string) => ({
      summary: "Three days",
      activities: [1, 2, 3].flatMap((day) => [
        { day, startTime: "09:30", endTime: "11:30", location: sights[day]!.name, detail: "Sight" },
        {
          day,
          startTime: "12:00",
          endTime: "13:00",
          location: day === 1 ? location : restaurants[day - 1]!.name,
          detail: "Lunch",
        },
      ]),
      assumptions: [],
    });
    const generate = vi
      .fn()
      .mockResolvedValueOnce(draft("Invented Bistro"))
      .mockResolvedValueOnce(draft("Ramen Ichi"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await createItineraryAgent({
      generator: { generate } as ItineraryGenerator,
    }).invoke({
      brief,
      context: context(byCategory),
    });

    expect(generate.mock.calls[0]![0].restaurantsByCity).toEqual({
      Tokyo: ["Ramen Ichi", "Sushi Ni", "Tempura San"],
    });
    expect(String(generate.mock.calls[1]![0].feedback)).toContain("Invented Bistro");
    expect(
      result.items.find((item) => item.day === 1 && item.startTime === "12:00")?.location,
    ).toBe("Ramen Ichi");
    warn.mockRestore();
  });
});
