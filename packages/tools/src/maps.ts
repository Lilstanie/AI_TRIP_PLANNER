import type { Place, PlaceQuery, RouteLeg, RouteOption, RouteQuery } from "@trip/shared";
import { createMapsPort } from "./maps-port";
import { toolRuntimeConfig } from "./runtime-context";

export type { GeoPoint, Place, PlaceQuery, RouteLeg, RouteQuery } from "@trip/shared";

export function route(query: RouteQuery): Promise<RouteLeg[]> {
  return createMapsPort(toolRuntimeConfig()).route(query);
}

export function places(query: PlaceQuery): Promise<Place[]> {
  return createMapsPort(toolRuntimeConfig()).places(query);
}

export function routeOptions(query: RouteQuery): Promise<RouteOption[]> {
  return createMapsPort(toolRuntimeConfig()).routeOptions!(query);
}
