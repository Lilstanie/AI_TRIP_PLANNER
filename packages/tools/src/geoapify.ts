import type { Place, PlaceQuery } from "@trip/shared";
import { toolFetch, toolRuntimeConfig } from "./runtime-context";

const OSM_TYPES: Record<string, string> = { n: "node", w: "way", r: "relation" };

const CATEGORIES: Record<string, string> = {
  sight: "tourism.sights,tourism.attraction",
  museum: "entertainment.museum,entertainment.culture.gallery",
  restaurant: "catering.restaurant,catering.cafe",
};

type Feature = {
  properties?: {
    name?: string;
    lat?: number;
    lon?: number;
    website?: string;
    datasource?: { raw?: Record<string, unknown> };
  };
};

async function request<T>(path: string, params: Record<string, string>): Promise<T> {
  const config = toolRuntimeConfig();
  const url = new URL(path, config.geoapifyBaseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("apiKey", config.geoapifyApiKey!);
  const response = await toolFetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Geoapify request failed (${response.status})`);
  return (await response.json()) as T;
}

export const geoapifyCategory = (q: PlaceQuery) =>
  Boolean(toolRuntimeConfig().geoapifyApiKey) &&
  !q.textQuery &&
  q.category !== undefined &&
  q.category in CATEGORIES;

export async function geoapifyPlaces(q: PlaceQuery): Promise<Place[]> {
  const { results = [] } = await request<{ results?: Array<{ lat?: number; lon?: number }> }>(
    "/v1/geocode/search",
    { text: q.near, type: "city", limit: "1", format: "json" },
  );
  const { lat, lon } = results[0] ?? {};
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const { features = [] } = await request<{ features?: Feature[] }>("/v2/places", {
    categories: CATEGORIES[q.category!]!,
    filter: `circle:${lon},${lat},15000`,
    bias: `proximity:${lon},${lat}`,
    limit: "40",
  });
  return features
    .map((feature) => feature.properties ?? {})
    .filter((place) => place.name?.trim())
    .sort(
      (a, b) =>
        Number(Boolean(b.datasource?.raw?.wikipedia)) -
        Number(Boolean(a.datasource?.raw?.wikipedia)),
    )
    .slice(0, 20)
    .map((place) => {
      const raw = place.datasource?.raw ?? {};
      const osmType = OSM_TYPES[String(raw.osm_type)];
      return {
        name: place.name!.trim(),
        category: q.category!,
        ...(osmType && Number.isInteger(raw.osm_id)
          ? { placeId: `osm:${osmType}/${raw.osm_id}` }
          : {}),
        ...(Number.isFinite(place.lat) && Number.isFinite(place.lon)
          ? { location: { latitude: place.lat!, longitude: place.lon! } }
          : {}),
        ...(place.website ? { website: place.website } : {}),
      };
    });
}
