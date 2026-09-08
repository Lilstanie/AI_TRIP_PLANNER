import { describe, expect, it } from "vitest";
import type { TripMapData } from "@trip/shared";
import { filterTripMap, mapDays } from "./map-data";

const map: TripMapData = {
  places: [
    {
      id: "one",
      name: "One",
      category: "activity",
      coordinates: { latitude: 35, longitude: 139 },
      day: 1,
      conflict: false,
    },
    {
      id: "two",
      name: "Two",
      category: "hotel",
      coordinates: { latitude: 35.1, longitude: 139.1 },
      day: 2,
      conflict: false,
    },
  ],
  routes: [
    {
      id: "route-two",
      fromPlaceId: "one",
      toPlaceId: "two",
      coordinates: [
        [139, 35],
        [139.1, 35.1],
      ],
      durationMin: 10,
      mode: "walk",
      day: 2,
      conflict: false,
    },
  ],
  unresolved: [],
};

describe("map day filtering", () => {
  it("derives unique ordered days from places and routes", () => {
    expect(mapDays(map)).toEqual([1, 2]);
  });

  it("returns only places and routes assigned to the selected day", () => {
    expect(filterTripMap(map, 2)).toMatchObject({
      places: [{ id: "two" }],
      routes: [{ id: "route-two" }],
    });
    expect(filterTripMap(map, undefined)).toBe(map);
  });
});
