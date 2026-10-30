import type { Place, PlaceQuery } from "@trip/shared";
import { findCity } from "./overpass";
import { toolFetch, toolRuntimeConfig } from "./runtime-context";

const CATEGORIES: Record<string, string> = {
  sight: "tourism.sights,tourism.attraction",
  museum: "entertainment.museum,entertainment.culture.gallery",
  restaurant: "catering.restaurant,catering.cafe",
};

type Feature = {
  properties?: {
    name?: unknown;
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

const notability = (place: NonNullable<Feature["properties"]>) =>
  (place.datasource?.raw?.wikipedia ? 2 : 0) + (place.datasource?.raw?.wikidata ? 1 : 0);

export const geoapifyCategory = (q: PlaceQuery) =>
  Boolean(toolRuntimeConfig().geoapifyApiKey) &&
  !q.textQuery &&
  q.category !== undefined &&
  q.category in CATEGORIES;

const distanceKm = (lat: number, lon: number, place: { lat?: number; lon?: number }) =>
  Math.hypot(
    ((place.lat ?? lat) - lat) * 111,
    ((place.lon ?? lon) - lon) * 111 * Math.cos((lat * Math.PI) / 180),
  );

export async function geoapifyPlaces(q: PlaceQuery): Promise<Place[]> {
  const city = await findCity(q.near);
  const lat = Number(city?.lat);
  const lon = Number(city?.lon);
  if (!city || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const { features = [] } = await request<{ features?: Feature[] }>("/v2/places", {
    categories: CATEGORIES[q.category!]!,
    filter: `circle:${lon},${lat},15000`,
    conditions: "named",
    limit: "500",
  });
  const seen = new Set<string>();
  return features
    .map((feature) => feature.properties ?? {})
    .flatMap((place) =>
      typeof place.name === "string" && place.name.trim()
        ? [{ ...place, name: place.name.trim() }]
        : [],
    )
    .sort(
      (a, b) => notability(b) - notability(a) || distanceKm(lat, lon, a) - distanceKm(lat, lon, b),
    )
    .filter((place) => {
      const key = place.name.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20)
    .map((place) => ({
      name: place.name,
      category: q.category!,
      ...(Number.isFinite(place.lat) && Number.isFinite(place.lon)
        ? { location: { latitude: place.lat!, longitude: place.lon! } }
        : {}),
      ...(place.website ? { website: place.website } : {}),
    }));
}
