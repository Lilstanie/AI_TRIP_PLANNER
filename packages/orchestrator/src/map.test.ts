import { describe, expect, it, vi } from "vitest";
import type { MapsPort, TripSection } from "@trip/shared";
import { enrichTripMap } from "./map";

const sections: TripSection[] = [
  {
    id: "itinerary",
    label: "Day plan",
    summary: "Two stops",
    status: "draft",
    estCost: 30,
    proposal: {
      agent: "itinerary",
      summary: "Two stops",
      assumptions: [],
      conflictsWith: [],
      items: [
        {
          kind: "activity",
          detail: "First stop",
          day: 1,
          startTime: "09:00",
          endTime: "10:00",
          location: "A",
        },
        {
          kind: "activity",
          detail: "Second stop",
          day: 1,
          startTime: "11:00",
          endTime: "12:00",
          location: "B",
        },
      ],
    },
  },
];

function maps(): MapsPort {
  const coordinates = {
    A: { latitude: 35, longitude: 139 },
    B: { latitude: 35.1, longitude: 139.1 },
  };
  return {
    places: vi.fn(async () => []),
    geocode: vi.fn(async ({ query }) => {
      const point = coordinates[query as keyof typeof coordinates];
      return point
        ? { id: query.toLowerCase(), name: query, category: "sight", coordinates: point }
        : null;
    }),
    route: vi.fn(async (query) => [
      {
        mode: "walk" as const,
        durationMin: 20,
        priceUsd: 0,
        distanceKm: 1.2,
        geometry: [
          [query.fromCoordinates!.longitude, query.fromCoordinates!.latitude],
          [query.toCoordinates!.longitude, query.toCoordinates!.latitude],
        ] as [[number, number], [number, number]],
      },
    ]),
  };
}

describe("trip map enrichment", () => {
  it("assembles places, daily routes and coordinates on proposal items", async () => {
    const result = await enrichTripMap(sections, maps(), "Tokyo");
    expect(result.map.places).toHaveLength(2);
    expect(result.map.routes).toHaveLength(1);
    expect(result.map.routes[0]).toMatchObject({ day: 1, durationMin: 20, distanceKm: 1.2 });
    expect(result.sections[0]?.proposal?.items[0]).toMatchObject({
      placeId: "itinerary-item-1",
      coordinates: { latitude: 35, longitude: 139 },
    });
  });

  it("records unresolved locations when geocoding fails without blocking the plan", async () => {
    const failingMaps = maps();
    failingMaps.geocode = vi.fn(async () => {
      throw new Error("provider offline");
    });
    const result = await enrichTripMap(sections, failingMaps, "Tokyo");
    expect(result.map.places).toEqual([]);
    expect(result.map.routes).toEqual([]);
    expect(result.map.unresolved).toHaveLength(2);
    expect(result.map.unresolved[0]?.reason).toBe("provider offline");
    expect(result.sections[0]?.proposal?.items[0]?.coordinates).toBeUndefined();
  });
});
