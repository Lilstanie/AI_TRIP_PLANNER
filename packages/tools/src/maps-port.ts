import type {
  GeoPoint,
  MapsPort,
  Place,
  PlaceQuery,
  RouteLeg,
  RouteOption,
  RouteQuery,
} from "@trip/shared";
import { searchGooglePlacesText } from "./google-places";
import { searchTransitSerpApi } from "./serpapi";
import { SUPPORTED_CURRENCIES, toAud } from "@trip/shared";
import { driveOption, transitOption, type GoogleRouteShape } from "./route-options";
import { toolFetch, toolNow, toolRuntimeConfig, type ToolRuntimeConfig } from "./runtime-context";

export type { GeoPoint, RouteQuery, RouteLeg, PlaceQuery, Place } from "@trip/shared";

function apiUrl(path: string): string {
  return `${toolRuntimeConfig().mapsApiBaseUrl}${path}`;
}

async function googleRequest<T>(url: string, body: unknown, fieldMask: string): Promise<T> {
  const response = await toolFetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": toolRuntimeConfig().mapsApiKey!,
      "x-goog-fieldmask": fieldMask,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Google Maps request failed (${response.status})`);
  return (await response.json()) as T;
}

async function googleGet<T>(url: string): Promise<T> {
  const response = await toolFetch(url, {
    headers: {
      "x-goog-api-key": toolRuntimeConfig().mapsApiKey!,
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Google Maps request failed (${response.status})`);
  return (await response.json()) as T;
}

async function osmRequest<T>(url: string): Promise<T> {
  const response = await toolFetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": toolRuntimeConfig().osmUserAgent || "ai-trip-planner/1.0 (local development)",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`OpenStreetMap request failed (${response.status})`);
  return (await response.json()) as T;
}

function usable(at: { latitude?: number; longitude?: number } | undefined): at is GeoPoint {
  return (
    at !== undefined &&
    Number.isFinite(at.latitude) &&
    Number.isFinite(at.longitude) &&
    Math.abs(at.latitude!) <= 90 &&
    Math.abs(at.longitude!) <= 180
  );
}

function waypoint(name: string, at?: GeoPoint) {
  return usable(at)
    ? { location: { latLng: { latitude: at.latitude, longitude: at.longitude } } }
    : { address: name };
}

async function geocode(query: string): Promise<GeoPoint | undefined> {
  const base = toolRuntimeConfig().nominatimBaseUrl;
  const results = await osmRequest<Array<{ lat: string; lon: string; display_name: string }>>(
    `${base}/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
  );
  const result = results[0];
  if (!result) return undefined;
  const at = { latitude: Number(result.lat), longitude: Number(result.lon) };
  if (!result.lat || !result.lon || !usable(at)) throw new Error("Invalid geocoding coordinates");
  return at;
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
  const delta = timestamp - toolNow().getTime();
  if (delta < -transitWindowMs.past || delta > transitWindowMs.future)
    throw new Error("Transit departure is outside Google's supported date window.");
}

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

  for (let offset = -14 * 60; offset <= 14 * 60; offset += 1) {
    const instant = naive - offset * 60_000;
    if (formatter.format(new Date(instant)).replace(" ", "T") === target) matches.push(instant);
  }
  if (matches.length !== 1)
    throw new Error("Local departure time is ambiguous or nonexistent due to daylight saving.");
  return new Date(matches[0]!).toISOString();
}

async function originTimeZone(q: RouteQuery, dateTimestamp: number): Promise<string> {
  const location = usable(q.fromLocation)
    ? q.fromLocation
    : (await searchGooglePlacesText(q.from, "places.location", 1))[0]?.location;
  if (!usable(location)) throw new Error("Google Places returned no valid origin coordinates.");

  const url = new URL("https://maps.googleapis.com/maps/api/timezone/json");
  url.search = new URLSearchParams({
    location: `${location.latitude},${location.longitude}`,
    timestamp: String(Math.floor((dateTimestamp + 12 * 60 * 60 * 1000) / 1000)),
    key: toolRuntimeConfig().mapsApiKey!,
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

  const roughDelta = dateTimestamp - toolNow().getTime();
  if (
    roughDelta < -(transitWindowMs.past + 86400000) ||
    roughDelta > transitWindowMs.future + 86400000
  )
    throw new Error("Transit departure is outside Google's supported date window.");
  const localTime = q.localTime ?? "09:00";
  if (!localTimePattern.test(localTime))
    throw new Error("Google transit route requires localTime in HH:MM format.");
  const zone = await originTimeZone(q, dateTimestamp);
  return localInstant(q.date, localTime, zone);
}

async function mockRoute(q: RouteQuery): Promise<RouteLeg[]> {
  return [{ mode: "train", durationMin: 140, price: 90, note: `mock ${q.from} -> ${q.to}` }];
}

async function osmRoute(q: RouteQuery): Promise<RouteLeg[]> {
  const [from, to] = await Promise.all([
    usable(q.fromLocation) ? q.fromLocation : geocode(q.from),
    usable(q.toLocation) ? q.toLocation : geocode(q.to),
  ]);
  if (!from || !to) return [];
  const base = toolRuntimeConfig().osrmBaseUrl;
  const data = await osmRequest<{ routes?: Array<{ duration?: number; distance?: number }> }>(
    `${base}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=false`,
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

async function googleRoute(q: RouteQuery): Promise<RouteLeg[]> {
  if (!toolRuntimeConfig().mapsApiKey)
    throw new Error("Google Maps provider requires MAPS_API_KEY.");
  const departureTime = await departureForGoogle(q);
  assertTransitWindow(Date.parse(departureTime));
  const data = await googleRequest<{
    routes?: Array<{ duration?: string; distanceMeters?: number }>;
  }>(
    apiUrl("/directions/v2:computeRoutes"),
    {
      origin: waypoint(q.from, q.fromLocation),
      destination: waypoint(q.to, q.toLocation),
      travelMode: "TRANSIT",
      departureTime,
    },
    "routes.duration,routes.distanceMeters",
  );
  const transit = data.routes?.[0];
  const transitLeg = transit ? googleLeg(transit, "transit") : undefined;
  if (transitLeg && transitLeg.durationMin <= SLOW_TRANSIT_MIN) return [transitLeg];

  if (q.intercity) {
    const rail = await railLeg(q).catch(() => undefined);
    if (rail && (!transitLeg || rail.durationMin < transitLeg.durationMin)) return [rail];
  }

  const driving = await googleRequest<{
    routes?: Array<{ duration?: string; distanceMeters?: number }>;
  }>(
    apiUrl("/directions/v2:computeRoutes"),
    {
      origin: waypoint(q.from, q.fromLocation),
      destination: waypoint(q.to, q.toLocation),
      travelMode: "DRIVE",
    },
    "routes.duration,routes.distanceMeters",
  );
  const drive = driving.routes?.[0];
  const driveLeg = drive ? googleLeg(drive, "drive") : undefined;
  if (transitLeg && (!driveLeg || transitLeg.durationMin <= driveLeg.durationMin * 2))
    return [transitLeg];
  return driveLeg ? [driveLeg] : [];
}

async function railLeg(q: RouteQuery): Promise<RouteLeg | undefined> {
  if (!toolRuntimeConfig().serpApiKey) return undefined;
  const route = await searchTransitSerpApi({ from: q.from, to: q.to });
  const passengers = q.passengers && q.passengers > 0 ? q.passengers : 1;
  const currency = SUPPORTED_CURRENCIES.find((code) => code === route.fare?.currency);

  const price =
    route.fare && currency
      ? Math.round(toAud(route.fare.amount, currency) * passengers * 100) / 100
      : 0;
  const service = route.services.join(" → ");
  const train = /shinkansen|express|limited|line|jr |rail|train/i.test(service);
  return {
    mode: train ? "train" : "transit",
    durationMin: route.durationMin,
    price,
    note: [
      `Google Maps transit via SerpApi${service ? `: ${service}` : ""}`,
      route.fare
        ? `${route.fare.currency} ${route.fare.amount.toLocaleString("en-AU")} per person${currency ? "" : "; fare unavailable in AUD"}`
        : "fare unavailable",
    ].join("; "),
  };
}

const SLOW_TRANSIT_MIN = 90;

function googleLeg(
  route: { duration?: string; distanceMeters?: number },
  mode: "transit" | "drive",
): RouteLeg {
  if (!route.duration || !/^\d+(?:\.\d+)?s$/.test(route.duration))
    throw new Error("Google Maps returned an invalid route duration");
  const seconds = Number(route.duration.slice(0, -1));
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new Error("Google Maps returned an invalid route duration");
  const distance = route.distanceMeters ? `; ${Math.round(route.distanceMeters)}m` : "";
  return {
    mode,
    durationMin: Math.max(1, Math.ceil(seconds / 60)),
    price: 0,
    note:
      mode === "drive"
        ? `Google Maps driving route; no public transport route found${distance}; fare unavailable`
        : `Google Maps route${distance}; fare unavailable`,
  };
}

async function mockPlaces(q: PlaceQuery): Promise<Place[]> {
  return [{ name: `Mock attraction near ${q.near}`, category: q.category ?? "sight", rating: 4.5 }];
}

async function osmPlaces(q: PlaceQuery): Promise<Place[]> {
  const base = toolRuntimeConfig().nominatimBaseUrl;
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

async function googlePlaces(q: PlaceQuery): Promise<Place[]> {
  if (!toolRuntimeConfig().mapsApiKey)
    throw new Error("Google Maps provider requires MAPS_API_KEY.");
  const results = await searchGooglePlacesText(
    `${q.category ?? "attraction"} in ${q.near}`,
    "places.displayName,places.types,places.rating,places.location,places.websiteUri",
  );
  return results
    .map((place) => ({
      name: place.displayName?.text?.trim() ?? "",
      category: q.category ?? place.types?.[0] ?? "place",

      ...(place.rating === undefined ? {} : { rating: place.rating }),

      ...(place.websiteUri?.trim() ? { website: place.websiteUri.trim() } : {}),
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

const OPTION_FIELDS = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.travelAdvisory.tollInfo",
  "routes.travelAdvisory.transitFare",
  "routes.legs.steps.transitDetails.transitLine.vehicle.type",
  "routes.legs.steps.transitDetails.transitLine.nameShort",
].join(",");

async function mockRouteOptions(q: RouteQuery): Promise<RouteOption[]> {
  return [
    {
      mode: "drive",
      durationMin: 35,
      distanceMeters: 24_000,
      price: 8,
      priceBasis: "partial",
      note: `mock drive ${q.from} -> ${q.to}; tolls only`,
    },
    {
      mode: "train",
      durationMin: 52,
      distanceMeters: 26_000,
      price: 0,
      priceBasis: "unavailable",
      note: `mock train ${q.from} -> ${q.to}; fare unavailable`,
    },
  ];
}

async function googleRouteOptions(q: RouteQuery): Promise<RouteOption[]> {
  if (!toolRuntimeConfig().mapsApiKey)
    throw new Error("Google Maps provider requires MAPS_API_KEY.");

  const departureTime = await departureForGoogle(q);
  const ask = (body: Record<string, unknown>) =>
    googleRequest<{ routes?: GoogleRouteShape[] }>(
      apiUrl("/directions/v2:computeRoutes"),
      {
        origin: waypoint(q.from, q.fromLocation),
        destination: waypoint(q.to, q.toLocation),
        ...body,
      },
      OPTION_FIELDS,
    ).then((data) => data.routes?.[0]);

  const [drive, transit] = await Promise.allSettled([
    ask({ travelMode: "DRIVE", extraComputations: ["TOLLS"] }),
    ask({ travelMode: "TRANSIT", departureTime }),
  ]);

  const options: RouteOption[] = [];
  if (drive.status === "fulfilled" && drive.value) {
    const option = driveOption(drive.value, q);
    if (option) options.push(option);
  }
  if (transit.status === "fulfilled" && transit.value) {
    const option = transitOption(transit.value, q);
    if (option) options.push(option);
  }

  return options.sort((a, b) => a.durationMin - b.durationMin);
}

function unsupportedMapsPort(providerName: string): MapsPort {
  const unsupported = async (): Promise<never> => {
    throw new Error(`Unsupported maps provider: ${providerName}`);
  };
  return {
    route: unsupported,
    places: unsupported,
    routeOptions: unsupported,
  };
}

export function createMapsPort(config: ToolRuntimeConfig, reportSelection = false): MapsPort {
  if (config.dataMode === "mock") {
    return {
      route: mockRoute,
      places: mockPlaces,
      routeOptions: mockRouteOptions,
    };
  }

  if (reportSelection) {
    const selection =
      config.mapsProvider === "google" && !config.mapsApiKey
        ? "Google Maps selected; MAPS_API_KEY is missing, so capabilities fail when called."
        : config.mapsProvider !== "google" && config.mapsProvider !== "osm"
          ? `${config.mapsProvider} Maps selected but unsupported; capabilities fail when called.`
          : `${config.mapsProvider} Maps adapter enabled.`;
    console.warn(`[tools] Live ${selection}`);
  }

  if (config.mapsProvider === "google") {
    return {
      route: googleRoute,
      places: googlePlaces,
      routeOptions: googleRouteOptions,
    };
  }

  if (config.mapsProvider === "osm") {
    if (reportSelection && !config.osmUserAgent) {
      console.warn("[tools] OSM_USER_AGENT is unset; configure one before production traffic.");
    }
    return {
      route: osmRoute,
      places: osmPlaces,
      routeOptions: async () => {
        throw new Error("Unsupported maps provider: osm");
      },
    };
  }

  return unsupportedMapsPort(config.mapsProvider);
}
