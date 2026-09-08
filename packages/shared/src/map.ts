import { z } from "zod";

export function tripItemId(sectionId: string, index: number): string {
  return `${sectionId}-item-${index + 1}`;
}

/** Geographic values always use latitude/longitude; route tuples use GeoJSON order. */
export const Coordinates = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type Coordinates = z.infer<typeof Coordinates>;

export const GeoJsonPosition = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
export type GeoJsonPosition = z.infer<typeof GeoJsonPosition>;

export const MapPlace = z.object({
  id: z.string(),
  providerPlaceId: z.string().optional(),
  name: z.string(),
  category: z.enum(["activity", "transport", "hotel", "meal", "destination", "other"]),
  coordinates: Coordinates,
  day: z.number().int().positive().optional(),
  itemId: z.string().optional(),
  sectionId: z.string().optional(),
  detail: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  estCost: z.number().nonnegative().optional(),
  conflict: z.boolean().default(false),
});
export type MapPlace = z.infer<typeof MapPlace>;

export const MapRoute = z.object({
  id: z.string(),
  fromPlaceId: z.string(),
  toPlaceId: z.string(),
  coordinates: z.array(GeoJsonPosition).min(2),
  durationMin: z.number().nonnegative(),
  distanceKm: z.number().nonnegative().optional(),
  mode: z.enum(["train", "flight", "bus", "walk", "transit"]),
  day: z.number().int().positive().optional(),
  itemId: z.string().optional(),
  conflict: z.boolean().default(false),
});
export type MapRoute = z.infer<typeof MapRoute>;

export const UnresolvedMapLocation = z.object({
  itemId: z.string(),
  location: z.string(),
  reason: z.string(),
});
export type UnresolvedMapLocation = z.infer<typeof UnresolvedMapLocation>;

export const TripMapData = z.object({
  places: z.array(MapPlace),
  routes: z.array(MapRoute),
  unresolved: z.array(UnresolvedMapLocation).default([]),
});
export type TripMapData = z.infer<typeof TripMapData>;
