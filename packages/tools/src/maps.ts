// Owner: B — Maps / Places adapter.
// OpenStreetMap Nominatim + OSRM are the default live provider because they are
// free to use. Respect their public-service rate limits and set a descriptive
// OSM_USER_AGENT in deployments. The deterministic fixture remains available
// for local tests.

import type { RouteQuery, RouteLeg, PlaceQuery, Place } from "@trip/shared";

export type { RouteQuery, RouteLeg, PlaceQuery, Place } from "@trip/shared";

const mockEnabled = () => process.env.USE_MOCK_TOOLS !== "false";
const provider = () => process.env.MAPS_PROVIDER || (process.env.MAPS_API_KEY ? "google" : "osm");

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

async function osmRequest<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": process.env.OSM_USER_AGENT || "ai-trip-planner/1.0 (local development)",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`OpenStreetMap request failed (${response.status})`);
  return (await response.json()) as T;
}

async function geocode(
  query: string,
): Promise<{ lat: number; lon: number; label: string } | undefined> {
  const base = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
  const results = await osmRequest<Array<{ lat: string; lon: string; display_name: string }>>(
    `${base}/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
  );
  const result = results[0];
  if (!result) return undefined;
  return { lat: Number(result.lat), lon: Number(result.lon), label: result.display_name };
}

export async function route(q: RouteQuery): Promise<RouteLeg[]> {
  if (mockEnabled()) {
    return [{ mode: "train", durationMin: 140, priceUsd: 90, note: `mock ${q.from} -> ${q.to}` }];
  }
  if (provider() === "osm") {
    const [from, to] = await Promise.all([geocode(q.from), geocode(q.to)]);
    if (!from || !to) return [];
    const base = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
    const data = await osmRequest<{ routes?: Array<{ duration?: number; distance?: number }> }>(
      `${base}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`,
    );
    const candidate = data.routes?.[0];
    if (!candidate) return [];
    return [
      {
        mode: "transit",
        durationMin: Math.max(1, Math.ceil((candidate.duration ?? 0) / 60)),
        priceUsd: 0,
        note: `Free OSRM route estimate via OpenStreetMap; ${Math.round(candidate.distance ?? 0)}m; fare unavailable`,
      },
    ];
  }
  if (provider() !== "google") throw new Error(`Unsupported maps provider: ${provider()}`);
  if (!process.env.MAPS_API_KEY) throw new Error("Google Maps provider requires MAPS_API_KEY.");
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
  if (provider() === "osm") {
    const base = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
    const results = await osmRequest<
      Array<{ display_name: string; type?: string; lat?: string; lon?: string }>
    >(
      `${base}/search?format=jsonv2&limit=5&q=${encodeURIComponent(`${q.category ?? "attraction"} in ${q.near}`)}`,
    );
    return results.map((place) => ({
      name: place.display_name,
      category: q.category ?? place.type ?? "place",
    }));
  }
  if (provider() !== "google") throw new Error(`Unsupported maps provider: ${provider()}`);
  if (!process.env.MAPS_API_KEY) throw new Error("Google Maps provider requires MAPS_API_KEY.");
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
