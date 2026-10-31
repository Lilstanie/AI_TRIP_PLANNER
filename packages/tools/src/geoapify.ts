import type { Place, PlaceQuery } from "@trip/shared";
import { findCity } from "./overpass";
import { toolFetch, toolNow, toolRuntimeConfig } from "./runtime-context";

const OSM_TYPES: Record<string, string> = { n: "node", w: "way", r: "relation" };

const LOCAL_LANGUAGE: Record<string, string> = {
  jp: "ja",
  cn: "zh",
  tw: "zh",
  hk: "zh",
  kr: "ko",
  th: "th",
  vn: "vi",
  fr: "fr",
  de: "de",
  it: "it",
  es: "es",
};

type Request = { categories: string; limit: number };

const CATEGORIES: Record<string, Request[]> = {
  sight: [
    { categories: "tourism.sights,tourism.attraction", limit: 500 },
    { categories: "religion.place_of_worship.buddhism", limit: 200 },
    { categories: "religion.place_of_worship.shinto", limit: 200 },
  ],
  museum: [{ categories: "entertainment.museum,entertainment.culture.gallery", limit: 500 }],
  restaurant: [{ categories: "catering.restaurant,catering.cafe", limit: 500 }],
  neighborhood: [
    {
      categories: "populated_place.suburb,populated_place.quarter,populated_place.neighbourhood",
      limit: 200,
    },
  ],
};

type Feature = {
  properties?: {
    name?: unknown;
    country_code?: string;
    iso3166_2?: string;
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
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Geoapify request failed (${response.status})`);
  return (await response.json()) as T;
}

const localName = (place: NonNullable<Feature["properties"]>): unknown => {
  const language = LOCAL_LANGUAGE[String(place.country_code).toLowerCase()];
  const local = language ? place.datasource?.raw?.[`name:${language}`] : undefined;
  return typeof local === "string" && local.trim() ? local : place.name;
};

const notability = ({ datasource }: NonNullable<Feature["properties"]>) => {
  const raw = datasource?.raw ?? {};
  return (
    (raw.wikipedia ? 2 : 0) +
    (raw.tourism ? 2 : 0) +
    (raw.wikidata ? 1 : 0) +
    (raw.image || raw.wikimedia_commons ? 1 : 0)
  );
};

export const geoapifyCategory = (q: PlaceQuery) =>
  Boolean(toolRuntimeConfig().geoapifyApiKey) &&
  !q.textQuery &&
  q.category !== undefined &&
  q.category in CATEGORIES;

const website = (place: NonNullable<Feature["properties"]>) => {
  const official = place.datasource?.raw?.["contact:website"];
  return typeof official === "string" && official ? official : place.website;
};

const distanceKm = (lat: number, lon: number, place: { lat?: number; lon?: number }) =>
  Math.hypot(
    ((place.lat ?? lat) - lat) * 111,
    ((place.lon ?? lon) - lon) * 111 * Math.cos((lat * Math.PI) / 180),
  );

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: Promise<Lookup> }>();

type Lookup = { places: Place[]; complete: boolean };

const message = (error: unknown) => (error instanceof Error ? error.message : "unknown error");

export function clearGeoapifyCacheForTests(): void {
  cache.clear();
}

export function geoapifyPlaces(q: PlaceQuery): Promise<Place[]> {
  const key = `${q.category}|${q.near.trim().toLocaleLowerCase()}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > toolNow().getTime()) return hit.value.then(({ places }) => places);
  const value = lookUp(q);
  cache.set(key, { expiresAt: toolNow().getTime() + CACHE_TTL_MS, value });
  const forget = () => {
    if (cache.get(key)?.value === value) cache.delete(key);
  };
  value.then(({ places, complete }) => (places.length === 0 || !complete) && forget(), forget);
  return value.then(({ places }) => places);
}

async function lookUp(q: PlaceQuery): Promise<Lookup> {
  const city = await findCity(q.near);
  const lat = Number(city?.lat);
  const lon = Number(city?.lon);
  if (!city || !Number.isFinite(lat) || !Number.isFinite(lon))
    return { places: [], complete: true };
  const requests = CATEGORIES[q.category!]!;
  const pages = await Promise.allSettled(
    requests.map(({ categories, limit }) =>
      request<{ features?: Feature[] }>("/v2/places", {
        categories,
        filter: `circle:${lon},${lat},15000`,
        conditions: "named",
        limit: String(limit),
      }),
    ),
  );
  const answered = pages.flatMap((page) => (page.status === "fulfilled" ? [page.value] : []));
  if (answered.length === 0) throw (pages[0] as PromiseRejectedResult).reason;
  pages.forEach((page, index) => {
    if (page.status === "rejected")
      console.warn(
        `[tools] Geoapify ${requests[index]!.categories} unavailable near ${q.near}: ${message(page.reason)}`,
      );
  });
  const region = city.address?.["ISO3166-2-lvl4"];
  const features = answered
    .flatMap((page) => page.features ?? [])
    .filter(
      ({ properties }) =>
        !region || typeof properties?.iso3166_2 !== "string" || properties.iso3166_2 === region,
    );
  const seen = new Set<string>();
  const places = features
    .map((feature) => feature.properties ?? {})
    .flatMap((place) => {
      const name = localName(place);
      return typeof name === "string" && name.trim() ? [{ ...place, name: name.trim() }] : [];
    })
    .sort(
      (a, b) => notability(b) - notability(a) || distanceKm(lat, lon, a) - distanceKm(lat, lon, b),
    )
    .filter((place) => {
      const raw = place.datasource?.raw ?? {};
      const keys = [place.name.toLocaleLowerCase(), `${raw.osm_type}/${raw.osm_id}`].filter(
        (key) => key !== "undefined/undefined",
      );
      if (keys.some((key) => seen.has(key))) return false;
      for (const key of keys) seen.add(key);
      return true;
    })
    .slice(0, 20)
    .map((place) => {
      const raw = place.datasource?.raw ?? {};
      const osmType = OSM_TYPES[String(raw.osm_type)];
      return {
        name: place.name,
        category: q.category!,
        ...(osmType && Number.isInteger(raw.osm_id)
          ? { placeId: `osm:${osmType}/${raw.osm_id}` }
          : {}),
        ...(Number.isFinite(place.lat) && Number.isFinite(place.lon)
          ? { location: { latitude: place.lat!, longitude: place.lon! } }
          : {}),
        ...(website(place) ? { website: website(place) } : {}),
      };
    });
  return { places, complete: answered.length === pages.length };
}
