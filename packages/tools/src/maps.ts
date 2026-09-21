// Owner: B — Maps / Places adapter.
// OpenStreetMap Nominatim + OSRM are the default live provider because they are
// free to use. Respect their public-service rate limits and set a descriptive
// OSM_USER_AGENT in deployments. The deterministic fixture remains available
// for local tests.

import type { RouteQuery, RouteLeg, PlaceQuery, Place } from "@trip/shared";
import { searchGooglePlacesText } from "./google-places";
import { mockEnabled } from "./data-mode";

export type { RouteQuery, RouteLeg, PlaceQuery, Place } from "@trip/shared";

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
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Google Maps request failed (${response.status})`);
  return (await response.json()) as T;
}

async function googleGet<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "x-goog-api-key": process.env.MAPS_API_KEY!,
    },
    signal: AbortSignal.timeout(8_000),
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
  const lat = Number(result.lat),
    lon = Number(result.lon);
  if (
    !result.lat ||
    !result.lon ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  )
    throw new Error("Invalid geocoding coordinates");
  return { lat, lon, label: result.display_name };
}

const localTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const isoInstantPattern =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function parseDate(date: string): number {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== date
  )
    throw new Error(`Google transit route requires a valid YYYY-MM-DD date: ${date}`);
  return timestamp;
}

function parseDepartureTime(value: string): number {
  if (!isoInstantPattern.test(value))
    throw new Error("Google transit route requires departureTime as an ISO instant.");
  const offset = /([+-])(\d{2}):(\d{2})$/.exec(value);
  if (offset && (Number(offset[2]) > 14 || (Number(offset[2]) === 14 && Number(offset[3]) !== 0)))
    throw new Error("Google transit route requires departureTime as an ISO instant.");
  try {
    parseDate(value.slice(0, 10));
  } catch {
    throw new Error("Google transit route requires departureTime as an ISO instant.");
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp))
    throw new Error("Google transit route requires departureTime as an ISO instant.");
  return timestamp;
}

const transitWindowMs = {
  past: 7 * 86400000,
  future: 100 * 86400000,
};

function assertTransitWindow(timestamp: number): void {
  const delta = timestamp - Date.now();
  if (delta < -transitWindowMs.past || delta > transitWindowMs.future)
    throw new Error("Transit departure is outside Google's supported date window.");
}

/** Convert a local wall time to UTC, rejecting DST gaps and repeated times. */
function localInstant(date: string, time: string, zone: string): string {
  const naive = Date.parse(`${date}T${time}:00.000Z`);
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const target = `${date}T${time}`;
  const matches: number[] = [];
  // Cover every valid UTC offset, including zones with non-hour offsets.
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 1) {
    const instant = naive - offset * 60_000;
    if (formatter.format(new Date(instant)).replace(" ", "T") === target) matches.push(instant);
  }
  if (matches.length !== 1)
    throw new Error("Local departure time is ambiguous or nonexistent due to daylight saving.");
  return new Date(matches[0]!).toISOString();
}

async function googleOriginTimeZone(from: string, dateTimestamp: number): Promise<string> {
  const places = await searchGooglePlacesText(from, "places.location", 1);
  const location = places[0]?.location;
  if (
    !location ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    Math.abs(location.latitude!) > 90 ||
    Math.abs(location.longitude!) > 180
  )
    throw new Error("Google Places returned no valid origin coordinates.");

  const url = new URL("https://maps.googleapis.com/maps/api/timezone/json");
  url.search = new URLSearchParams({
    location: `${location.latitude},${location.longitude}`,
    timestamp: String(Math.floor((dateTimestamp + 12 * 60 * 60 * 1000) / 1000)),
    key: process.env.MAPS_API_KEY!,
  }).toString();
  const timezone = await googleGet<{ status?: string; timeZoneId?: string }>(url.toString());
  if (timezone.status !== "OK" || typeof timezone.timeZoneId !== "string")
    throw new Error("Google could not verify the origin time zone.");
  return timezone.timeZoneId;
}

async function departureForGoogle(q: RouteQuery): Promise<string> {
  if (q.departureTime !== undefined)
    return new Date(parseDepartureTime(q.departureTime)).toISOString();
  if (q.date === undefined)
    throw new Error("Google transit route requires a date or explicit departureTime.");
  const dateTimestamp = parseDate(q.date);
  // A date clearly outside the provider window can be rejected before the
  // Places/Time Zone lookups. Near a boundary, resolve the true instant first.
  const roughDelta = dateTimestamp - Date.now();
  if (
    roughDelta < -(transitWindowMs.past + 86400000) ||
    roughDelta > transitWindowMs.future + 86400000
  )
    throw new Error("Transit departure is outside Google's supported date window.");
  const localTime = q.localTime ?? "09:00";
  if (!localTimePattern.test(localTime))
    throw new Error("Google transit route requires localTime in HH:MM format.");
  const zone = await googleOriginTimeZone(q.from, dateTimestamp);
  return localInstant(q.date, localTime, zone);
}

export async function route(q: RouteQuery): Promise<RouteLeg[]> {
  if (mockEnabled()) {
    return [{ mode: "train", durationMin: 140, price: 90, note: `mock ${q.from} -> ${q.to}` }];
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
    if (!Number.isFinite(candidate.duration) || candidate.duration! <= 0)
      throw new Error("OSRM returned an invalid route duration");
    return [
      {
        mode: "transit",
        durationMin: Math.max(1, Math.ceil(candidate.duration! / 60)),
        price: 0,
        note: `OSRM driving-only estimate, not verified public transport; ${Math.round(candidate.distance ?? 0)}m; fare unavailable`,
      },
    ];
  }
  if (provider() !== "google") throw new Error(`Unsupported maps provider: ${provider()}`);
  if (!process.env.MAPS_API_KEY) throw new Error("Google Maps provider requires MAPS_API_KEY.");
  const departureTime = await departureForGoogle(q);
  assertTransitWindow(Date.parse(departureTime));
  const data = await googleRequest<{
    routes?: Array<{ duration?: string; distanceMeters?: number }>;
  }>(
    apiUrl("/directions/v2:computeRoutes"),
    {
      origin: { address: q.from },
      destination: { address: q.to },
      travelMode: "TRANSIT",
      departureTime,
    },
    "routes.duration,routes.distanceMeters",
  );
  const route = data.routes?.[0];
  if (!route) return [];
  if (!route.duration || !/^\d+(?:\.\d+)?s$/.test(route.duration))
    throw new Error("Google Maps returned an invalid route duration");
  const seconds = Number(route.duration.slice(0, -1));
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new Error("Google Maps returned an invalid route duration");
  return [
    {
      mode: "transit",
      durationMin: Math.max(1, Math.ceil(seconds / 60)),
      price: 0,
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
      ...(Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lon))
        ? { location: { latitude: Number(place.lat), longitude: Number(place.lon) } }
        : {}),
    }));
  }
  if (provider() !== "google") throw new Error(`Unsupported maps provider: ${provider()}`);
  if (!process.env.MAPS_API_KEY) throw new Error("Google Maps provider requires MAPS_API_KEY.");
  const results = await searchGooglePlacesText(
    `${q.category ?? "attraction"} in ${q.near}`,
    "places.displayName,places.types,places.rating,places.location",
  );
  return results
    .map((place) => ({
      name: place.displayName?.text?.trim() ?? "",
      category: q.category ?? place.types?.[0] ?? "place",
      // Google's own 1.0-5.0 place-rating scale, shown verbatim in agent text
      // ("supplied rating 4.5") — unlike accommodation, nothing here compares
      // it numerically against this project's 0-10 convention, so it is not
      // converted.
      ...(place.rating === undefined ? {} : { rating: place.rating }),
      ...(place.location &&
      Number.isFinite(place.location.latitude) &&
      Number.isFinite(place.location.longitude)
        ? {
            location: {
              latitude: place.location.latitude!,
              longitude: place.location.longitude!,
            },
          }
        : {}),
    }))
    .filter((place) => place.name.length > 0);
}
