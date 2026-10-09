import { z } from "zod";
import { NoticeError } from "@/lib/i18n/notice";
import { MapProviderUnavailableError } from "./errors";
import { nominatimRequest, providerCache, providerJson, type ProviderFetch } from "./http";
import type { MapPlace, PlaceSearch } from "./types";

const osmType = z.enum(["node", "way", "relation"]);
const osmId = z.coerce.number().int().positive();
const point = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});
const nominatimPlace = z.object({
  osm_type: osmType,
  osm_id: osmId,
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  name: z.string().optional(),
  display_name: z.string().optional(),
  type: z.string().optional(),
  extratags: z.record(z.string(), z.string()).nullish(),
});
const photonFeature = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({ osm_type: z.enum(["N", "W", "R"]), osm_id: osmId }).catchall(z.unknown()),
});
const httpUrl = (value?: string) => (value && /^https?:\/\//i.test(value) ? value : undefined);
const TYPE = { N: "node", W: "way", R: "relation" } as const;

function fromNominatim(raw: unknown): MapPlace | undefined {
  const parsed = nominatimPlace.safeParse(raw);
  if (!parsed.success) return;
  const p = parsed.data;
  const coordinates = point.safeParse({ latitude: p.lat, longitude: p.lon });
  if (!coordinates.success) return;
  const tags = p.extratags ?? {};
  return {
    id: `osm:${p.osm_type}/${p.osm_id}`,
    source: "osm",
    displayName: { text: p.name || p.display_name?.split(",")[0] || "OpenStreetMap place" },
    formattedAddress: p.display_name,
    location: coordinates.data,
    primaryType: p.type,
    osmUri: `https://www.openstreetmap.org/${p.osm_type}/${p.osm_id}`,
    websiteUri: httpUrl(tags.website || tags["contact:website"]),
    phone: tags.phone || tags["contact:phone"],
    openingHours: tags.opening_hours,
    wikidata: /^Q\d+$/.test(tags.wikidata || "") ? tags.wikidata : undefined,
    commonsFile: tags.wikimedia_commons?.startsWith("File:")
      ? tags.wikimedia_commons.slice(5)
      : undefined,
  };
}
function fromPhoton(raw: unknown): MapPlace | undefined {
  const parsed = photonFeature.safeParse(raw);
  if (!parsed.success) return;
  const { properties: p, geometry } = parsed.data;
  const location = point.safeParse({
    latitude: geometry.coordinates[1],
    longitude: geometry.coordinates[0],
  });
  if (!location.success) return;
  const id = `osm:${TYPE[p.osm_type]}/${p.osm_id}`;
  const strings = (keys: string[]) =>
    keys.flatMap((k) => (typeof p[k] === "string" ? [p[k] as string] : []));
  return {
    id,
    source: "osm",
    location: location.data,
    displayName: { text: strings(["name", "street", "city"])[0] || "OpenStreetMap place" },
    formattedAddress: strings(["housenumber", "street", "city", "state", "country"]).join(", "),
    primaryType: strings(["osm_value"])[0],
    osmUri: `https://www.openstreetmap.org/${TYPE[p.osm_type]}/${p.osm_id}`,
  };
}

export function osmPlaces(fetcher?: ProviderFetch) {
  const cached = providerCache<MapPlace[]>();
  const base = () =>
    (process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, "");
  const nominatim = (path: string, params: Record<string, string>) => {
    const url = new URL(`${base()}/${path}`);
    Object.entries({ format: "jsonv2", extratags: "1", ...params }).forEach(([k, v]) =>
      url.searchParams.set(k, v),
    );
    return cached(url.href, async () => {
      const body = await nominatimRequest(() => providerJson(url.href, fetcher));
      if (!Array.isArray(body)) throw new MapProviderUnavailableError("osm", "upstream");
      return body.flatMap((p) => fromNominatim(p) ?? []);
    });
  };
  async function photon(query: PlaceSearch, bbox?: string): Promise<MapPlace[]> {
    const url = new URL(
      `${(process.env.PHOTON_BASE_URL || "https://photon.komoot.io").replace(/\/$/, "")}/api/`,
    );
    url.searchParams.set("q", query.text);
    url.searchParams.set("limit", "5");
    // Photon only accepts languages installed in its index; Chinese names are selected by Nominatim.
    if (query.language === "en") url.searchParams.set("lang", "en");
    if (bbox) url.searchParams.set("bbox", bbox);
    return cached(url.href, async () => {
      const body = (await providerJson(url.href, fetcher)) as { features?: unknown[] };
      if (!Array.isArray(body?.features)) throw new MapProviderUnavailableError("osm", "upstream");
      return body.features.flatMap((p) => fromPhoton(p) ?? []);
    });
  }
  async function search(query: PlaceSearch): Promise<MapPlace[]> {
    let bounds: number[] | undefined;
    if (query.destination && query.destination !== query.text) {
      const city = (await search({ text: query.destination, language: query.language }))[0];
      if (!city?.location) return [];
      const { longitude: x, latitude: y } = city.location;
      bounds = [
        Math.max(-180, x - 0.5),
        Math.max(-90, y - 0.5),
        Math.min(180, x + 0.5),
        Math.min(90, y + 0.5),
      ];
    }
    const params = {
      q: query.text,
      limit: "5",
      "accept-language": query.language || "en",
      ...(bounds
        ? { viewbox: `${bounds[0]},${bounds[3]},${bounds[2]},${bounds[1]}`, bounded: "1" }
        : {}),
    };
    if (query.language === "zh") return nominatim("search", params);
    try {
      return await photon(query, bounds?.join(","));
    } catch {
      return nominatim("search", params);
    }
  }
  return {
    search,
    async details(id: string, language: "en" | "zh" = "en"): Promise<MapPlace> {
      const match = /^osm:(node|way|relation)\/(\d+)$/.exec(id);
      if (!match) throw new NoticeError({ key: "This saved place is no longer available." });
      const prefix = { node: "N", way: "W", relation: "R" }[match[1]!];
      const places = await nominatim("lookup", {
        osm_ids: `${prefix}${match[2]}`,
        "accept-language": language,
      });
      const place = places.find((p) => p.id === id);
      if (!place) throw new NoticeError({ key: "This saved place is no longer available." });
      return place;
    },
  };
}
