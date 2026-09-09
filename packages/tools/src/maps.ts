// Owner: B — Maps / Places adapter.
// Google Maps Platform is used when USE_MOCK_TOOLS=false and MAPS_API_KEY is
// configured. The deterministic fixture remains available for local tests.

import type { RouteQuery, RouteLeg, PlaceQuery, Place } from "@trip/shared";

export type { RouteQuery, RouteLeg, PlaceQuery, Place } from "@trip/shared";

const mockEnabled = () => process.env.USE_MOCK_TOOLS !== "false" || !process.env.MAPS_API_KEY;

function apiUrl(path: string): string {
  return `${process.env.MAPS_API_BASE_URL || "https://routes.googleapis.com"}${path}`;
}

async function googleRequest<T>(url: string, body: unknown, fieldMask: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env.MAPS_API_KEY!,
      "x-goog-fieldmask": fieldMask,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Google Maps request failed (${response.status})`);
  return (await response.json()) as T;
}

export async function route(q: RouteQuery): Promise<RouteLeg[]> {
  if (mockEnabled()) {
    return [{ mode: "train", durationMin: 140, priceUsd: 90, note: `mock ${q.from} -> ${q.to}` }];
  }
  const data = await googleRequest<{
    routes?: Array<{ duration?: string; distanceMeters?: number }>;
  }>(
    apiUrl("/directions/v2:computeRoutes"),
    {
      origin: { address: q.from },
      destination: { address: q.to },
      travelMode: "TRANSIT",
      departureTime: q.date ? `${q.date}T09:00:00Z` : undefined,
    },
    "routes.duration,routes.distanceMeters",
  );
  const route = data.routes?.[0];
  if (!route) return [];
  const seconds = Number.parseInt(route.duration?.replace(/s$/, "") || "0", 10);
  return [
    {
      mode: "transit",
      durationMin: Math.max(1, Math.ceil(seconds / 60)),
      priceUsd: 0,
      note: `Google Maps route${route.distanceMeters ? `; ${Math.round(route.distanceMeters)}m` : ""}; fare unavailable`,
    },
  ];
}

export async function places(q: PlaceQuery): Promise<Place[]> {
  if (mockEnabled()) {
    return [
      { name: `Mock attraction near ${q.near}`, category: q.category ?? "sight", rating: 4.5 },
    ];
  }
  const data = await googleRequest<{
    places?: Array<{ displayName?: { text?: string }; types?: string[]; rating?: number }>;
  }>(
    "https://places.googleapis.com/v1/places:searchText",
    {
      textQuery: `${q.category ?? "attraction"} in ${q.near}`,
      pageSize: 5,
    },
    "places.displayName,places.types,places.rating",
  );
  return (data.places ?? [])
    .map((place) => ({
      name: place.displayName?.text?.trim() ?? "",
      category: q.category ?? place.types?.[0] ?? "place",
      ...(place.rating === undefined ? {} : { rating: place.rating }),
    }))
    .filter((place) => place.name.length > 0);
}
