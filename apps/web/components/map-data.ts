import type { TripMapData } from "@trip/shared";

export function mapDays(map: TripMapData | undefined): number[] {
  if (!map) return [];
  return [
    ...new Set(
      [...map.places, ...map.routes]
        .map((entry) => entry.day)
        .filter((day): day is number => day !== undefined),
    ),
  ].sort((left, right) => left - right);
}

export function filterTripMap(map: TripMapData | undefined, day: number | undefined): TripMapData {
  if (!map) return { places: [], routes: [], unresolved: [] };
  if (day === undefined) return map;
  return {
    places: map.places.filter((place) => place.day === day),
    routes: map.routes.filter((route) => route.day === day),
    unresolved: map.unresolved,
  };
}
