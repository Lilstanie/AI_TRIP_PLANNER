import type { Place, PlaceQuery } from "@trip/shared";
import { toolFetch, toolRuntimeConfig } from "./runtime-context";

const TAGS: Record<string, { filters: string[]; notable: boolean }> = {
  sight: {
    filters: [
      '["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium)$"]',
      '["historic"~"^(castle|monument|memorial|temple|shrine|palace)$"]',
      '["amenity"="place_of_worship"]',
    ],
    notable: true,
  },
  museum: { filters: ['["tourism"~"^(museum|gallery)$"]'], notable: true },
  neighborhood: { filters: ['["place"~"^(suburb|quarter|neighbourhood)$"]'], notable: true },
  restaurant: { filters: ['["amenity"~"^(restaurant|cafe|food_court)$"]'], notable: false },
};

type Area = {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  boundingbox?: string[];
};
type Element = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await toolFetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "user-agent": toolRuntimeConfig().osmUserAgent || "ai-trip-planner/1.0 (local development)",
      ...init.headers,
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`OpenStreetMap request failed (${response.status})`);
  return (await response.json()) as T;
}

export async function findCity(near: string): Promise<Area | undefined> {
  const [area] = await request<Area[]>(
    `${toolRuntimeConfig().nominatimBaseUrl}/search?format=jsonv2&limit=1&q=${encodeURIComponent(near)}`,
  );
  return area;
}

export const overpassCategory = (q: PlaceQuery) =>
  !q.textQuery && q.category !== undefined && q.category in TAGS;

export async function overpassPlaces(q: PlaceQuery): Promise<Place[]> {
  const { filters, notable } = TAGS[q.category!]!;
  const config = toolRuntimeConfig();
  const area = await findCity(q.near);
  if (!area) return [];
  const box = area.boundingbox?.map(Number);
  const scope =
    area.osm_type === "relation" && area.osm_id
      ? { set: `area(id:${3_600_000_000 + area.osm_id})->.a;`, filter: "(area.a)" }
      : box?.length === 4 && box.every(Number.isFinite)
        ? { set: "", filter: `(${box[0]},${box[2]},${box[1]},${box[3]})` }
        : undefined;
  if (!scope) return [];
  const query = `[out:json][timeout:20];${scope.set}(${filters
    .map((tags) => `nwr${scope.filter}${tags}["name"]${notable ? '["wikidata"]' : ""};`)
    .join("")});out center 40;`;
  const { elements = [], remark } = await request<{ elements?: Element[]; remark?: string }>(
    `${config.overpassBaseUrl}/interpreter`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    },
  );
  if (remark?.includes("error")) throw new Error(`Overpass query failed: ${remark}`);
  return elements
    .filter((element) => element.tags?.name?.trim())
    .sort((a, b) => Number(Boolean(b.tags?.wikipedia)) - Number(Boolean(a.tags?.wikipedia)))
    .slice(0, 20)
    .map((element) => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      return {
        name: element.tags!.name!.trim(),
        category: q.category!,
        ...(element.type && element.id ? { placeId: `osm:${element.type}/${element.id}` } : {}),
        ...(Number.isFinite(lat) && Number.isFinite(lon)
          ? { location: { latitude: lat!, longitude: lon! } }
          : {}),
        ...(element.tags?.website ? { website: element.tags.website } : {}),
      };
    });
}
