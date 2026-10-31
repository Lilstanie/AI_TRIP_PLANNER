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
  const port = createMapsPort(toolRuntimeConfig());
  if (!port.routeOptions)
    return Promise.reject(new Error("Route options are not offered by this maps provider"));
  return port.routeOptions(query);
}
