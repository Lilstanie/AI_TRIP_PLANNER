import { describe, expect, it } from "vitest";
import { ProposalItem } from "./contracts";
import { Coordinates, MapRoute, TripMapData, tripItemId } from "./map";

describe("map contracts", () => {
  it("accepts valid coordinates and rejects out-of-range values", () => {
    expect(Coordinates.parse({ latitude: -33.86, longitude: 151.2 })).toEqual({
      latitude: -33.86,
      longitude: 151.2,
    });
    expect(() => Coordinates.parse({ latitude: 91, longitude: 151.2 })).toThrow();
  });

  it("validates route geometry and defaults optional map collections", () => {
    const route = MapRoute.parse({
      id: "route-1",
      fromPlaceId: "a",
      toPlaceId: "b",
      coordinates: [
        [139.7, 35.6],
        [135.7, 35],
      ],
      durationMin: 140,
      mode: "train",
    });
    expect(route.conflict).toBe(false);
    expect(TripMapData.parse({ places: [], routes: [] }).unresolved).toEqual([]);
    expect(() => MapRoute.parse({ ...route, coordinates: [[139.7, 35.6]] })).toThrow();
  });

  it("keeps proposal map fields optional and generates stable item ids", () => {
    const item = ProposalItem.parse({ kind: "activity", detail: "Walk" });
    expect(item.coordinates).toBeUndefined();
    expect(tripItemId("itinerary", 2)).toBe("itinerary-item-3");
  });
});
