import { durableStoreConfigured, jsonStore } from "@trip/services";
import type { FlightLeg, FlightOption, StayOption } from "@trip/shared";
import { airportCodeFor } from "./airports";
import { legFrom, isRoundTrip, departureToken, type RawItinerary } from "./flight-itinerary";
import { toolFetch, toolNow, toolRuntimeConfig } from "./runtime-context";

const MONTHLY_LIMIT = 230;
const CACHE_TTL_MS = 15 * 60 * 1000;

export type SerpApiErrorReason =
  | "not_configured"
  | "invalid_key"
  | "quota_exceeded"
  | "no_results"
  | "request_failed"
  | "unsupported_location";

export class SerpApiError extends Error {
  constructor(
    message: string,
    readonly reason: SerpApiErrorReason,
  ) {
    super(message);
    this.name = "SerpApiError";
  }
}

let usage = { month: "", count: 0 };
function currentMonth(): string {
  return toolNow().toISOString().slice(0, 7);
}
function rolloverIfNewMonth(): void {
  const month = currentMonth();
  if (usage.month !== month) usage = { month, count: 0 };
}
async function reserveQuota(): Promise<{ commit(): void; release(): Promise<void> }> {
  rolloverIfNewMonth();
  if (!durableStoreConfigured()) {
    if (usage.count >= MONTHLY_LIMIT) {
      throw new SerpApiError(
        `SerpApi's shared monthly search limit (${MONTHLY_LIMIT}) is reached for ${usage.month}.`,
        "quota_exceeded",
      );
    }
    return {
      commit() {
        usage.count += 1;
      },
      async release() {},
    };
  }
  const month = currentMonth();
  const count = await jsonStore.increment(`trip:serpapi:usage:${month}`);
  usage = { month, count };
  if (count > MONTHLY_LIMIT) {
    throw new SerpApiError(
      `SerpApi's shared monthly search limit (${MONTHLY_LIMIT}) is reached for ${usage.month}.`,
      "quota_exceeded",
    );
  }
  return {
    commit() {},
    async release() {
      const remaining = await jsonStore.decrement(`trip:serpapi:usage:${month}`);
      usage = { month, count: remaining };
    },
  };
}

export function serpApiUsage(): { month: string; count: number; limit: number } {
  rolloverIfNewMonth();
  return { ...usage, limit: MONTHLY_LIMIT };
}

export function resetSerpApiUsageForTests(): void {
  usage = { month: "", count: 0 };
}

const cache = new Map<string, { expiresAt: number; value: unknown }>();
async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (durableStoreConfigured()) {
    const stored = await jsonStore.get<{ expiresAt: number; value: T }>(
      `trip:serpapi:cache:${key}`,
    );
    if (stored && stored.expiresAt > toolNow().getTime()) return stored.value;
    const value = await fetcher();
    await jsonStore.set(`trip:serpapi:cache:${key}`, {
      expiresAt: toolNow().getTime() + CACHE_TTL_MS,
      value,
    });
    return value;
  }
  const hit = cache.get(key);
  if (hit && hit.expiresAt > toolNow().getTime()) return hit.value as T;
  const value = await fetcher();
  cache.set(key, { expiresAt: toolNow().getTime() + CACHE_TTL_MS, value });
  return value;
}

export function clearSerpApiCacheForTests(): void {
  cache.clear();
}

function apiKey(): string {
  const key = toolRuntimeConfig().serpApiKey;
  if (!key) throw new SerpApiError("SerpApi is not configured. Add SERPAPI_KEY.", "not_configured");
  return key;
}

interface SerpApiRaw {
  error?: string;
  properties?: unknown[];
  best_flights?: unknown[];
  other_flights?: unknown[];
  directions?: unknown[];
}

async function serpApiSearch(params: Record<string, string>): Promise<SerpApiRaw> {
  const reservation = await reserveQuota();
  try {
    const url = new URL("https://serpapi.com/search.json");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("api_key", apiKey());

    let response: Response;
    try {
      response = await toolFetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      throw new SerpApiError(
        `SerpApi request failed: ${error instanceof Error ? error.message : "network error"}.`,
        "request_failed",
      );
    }

    let data: SerpApiRaw;
    try {
      data = (await response.json()) as SerpApiRaw;
    } catch {
      throw new SerpApiError("SerpApi returned an unreadable response.", "request_failed");
    }

    if (!response.ok || data.error) {
      const message = typeof data.error === "string" ? data.error : `HTTP ${response.status}`;
      if (/invalid api key/i.test(message)) {
        throw new SerpApiError(`SerpApi rejected the configured key: ${message}`, "invalid_key");
      }
      if (/run out of searches|account has been suspended/i.test(message)) {
        throw new SerpApiError(`SerpApi account limit reached: ${message}`, "quota_exceeded");
      }
      throw new SerpApiError(`SerpApi request failed: ${message}`, "request_failed");
    }

    reservation.commit();
    return data;
  } catch (error) {
    await reservation.release();
    throw error;
  }
}

function normalizedRating(value: unknown): number {
  const rating = Number(value);
  return Number.isFinite(rating) ? Math.round(rating * 2 * 10) / 10 : 0;
}

export async function searchHotelsSerpApi(q: {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}): Promise<StayOption[]> {
  const key = `hotels:${q.city.toLowerCase()}|${q.checkIn}|${q.checkOut}|${q.guests}`;
  return cached(key, async () => {
    const data = await serpApiSearch({
      engine: "google_hotels",
      q: q.city,
      check_in_date: q.checkIn,
      check_out_date: q.checkOut,
      adults: String(q.guests),
      currency: "AUD",
    });
    const queriedAt = toolNow().toISOString();
    const properties = Array.isArray(data.properties) ? data.properties : [];
    const options: StayOption[] = properties
      .map((raw): StayOption => {
        const property = raw as {
          name?: unknown;
          rate_per_night?: { extracted_lowest?: unknown };
          overall_rating?: unknown;
          gps_coordinates?: { latitude?: unknown; longitude?: unknown };
          serpapi_property_details_link?: unknown;
        };
        const latitude = Number(property.gps_coordinates?.latitude);
        const longitude = Number(property.gps_coordinates?.longitude);
        return {
          name: typeof property.name === "string" ? property.name.trim() : "",
          area: q.city,
          pricePerNight: Number(property.rate_per_night?.extracted_lowest),
          rating: normalizedRating(property.overall_rating),

          freeCancellation: false,
          grounded: true,
          provenance: {
            kind: "live",
            provider: "SerpApi Google Hotels",
            queriedAt,
          },
          ...(Number.isFinite(latitude) && Number.isFinite(longitude)
            ? { location: { latitude, longitude } }
            : {}),
          ...(typeof property.serpapi_property_details_link === "string"
            ? { detailsUrl: property.serpapi_property_details_link }
            : {}),
        };
      })
      .filter(
        (option) =>
          option.name.length > 0 &&
          Number.isFinite(option.pricePerNight) &&
          option.pricePerNight > 0,
      );
    if (options.length === 0) {
      throw new SerpApiError(`SerpApi returned no hotel results for ${q.city}.`, "no_results");
    }
    return options;
  });
}

function airportCode(city: string): string {
  const code = airportCodeFor(city);
  if (!code) {
    throw new SerpApiError(
      `SerpApi's flight search needs an airport code for "${city}", and this project has no mapping for it yet. Add it to packages/tools/src/airports.ts, or search with a 3-letter code directly.`,
      "unsupported_location",
    );
  }
  return code;
}

export async function searchFlightsSerpApi(q: {
  from: string;
  to: string;
  depart: string;
  return?: string;
  passengers: number;
}): Promise<FlightOption[]> {
  const key = `flights:${q.from.toLowerCase()}|${q.to.toLowerCase()}|${q.depart}|${q.return ?? ""}|${q.passengers}`;
  return cached(key, async () => {
    const data = await serpApiSearch({
      engine: "google_flights",
      departure_id: airportCode(q.from),
      arrival_id: airportCode(q.to),
      outbound_date: q.depart,
      adults: String(q.passengers),
      currency: "AUD",
      ...(q.return ? { return_date: q.return, type: "1" } : { type: "2" }),
    });
    const queriedAt = toolNow().toISOString();
    const flights = [...(data.best_flights ?? []), ...(data.other_flights ?? [])];
    const options: FlightOption[] = flights
      .map((raw): FlightOption => {
        const flight = raw as RawItinerary & { flights?: Array<{ airline?: unknown }> };
        const airline = flight.flights?.[0]?.airline;
        const outbound = legFrom(flight);
        const token = departureToken(flight);
        const durationMin = Number(flight.total_duration);

        const perPassenger = Number(flight.price);
        return {
          carrier: typeof airline === "string" ? airline.trim() : "",
          price: perPassenger * q.passengers,
          stops: Array.isArray(flight.layovers) ? flight.layovers.length : 0,
          ...(Number.isFinite(durationMin) ? { durationMin } : {}),
          ...(outbound ? { outbound } : {}),
          ...(isRoundTrip(flight) ? { roundTrip: true } : {}),

          ...(token ? { returnToken: token } : {}),
          provenance: {
            kind: "live",
            provider: "SerpApi Google Flights",
            queriedAt,
          },
          note: `${q.from} ${q.return ? "<->" : "->"} ${q.to}; ${q.passengers} passenger(s); ${q.return ? "round-trip" : "one-way"} group total in AUD; real-time SerpApi fare.`,
        };
      })
      .filter(
        (option) => option.carrier.length > 0 && Number.isFinite(option.price) && option.price > 0,
      );
    if (options.length === 0) {
      throw new SerpApiError(
        `SerpApi returned no flight results for ${q.from} to ${q.to}.`,
        "no_results",
      );
    }
    return options;
  });
}

export async function searchReturnLegSerpApi(q: {
  from: string;
  to: string;
  depart: string;
  return: string;
  passengers: number;
  token: string;
}): Promise<FlightLeg | undefined> {
  const key = `return:${q.from.toLowerCase()}|${q.to.toLowerCase()}|${q.depart}|${q.return}|${q.passengers}|${q.token.slice(0, 32)}`;
  return cached(key, async () => {
    const data = await serpApiSearch({
      engine: "google_flights",
      departure_id: airportCode(q.from),
      arrival_id: airportCode(q.to),
      outbound_date: q.depart,
      return_date: q.return,
      adults: String(q.passengers),
      currency: "AUD",
      type: "1",
      departure_token: q.token,
    });
    const itineraries = [...(data.best_flights ?? []), ...(data.other_flights ?? [])];

    for (const raw of itineraries) {
      const leg = legFrom(raw as RawItinerary);
      if (leg) return leg;
    }
    return undefined;
  });
}

export interface TransitRoute {
  durationMin: number;

  fare?: { amount: number; currency: string };

  services: string[];
}

export async function searchTransitSerpApi(q: { from: string; to: string }): Promise<TransitRoute> {
  const key = `transit:${q.from.toLowerCase()}|${q.to.toLowerCase()}`;
  return cached(key, async () => {
    const data = await serpApiSearch({
      engine: "google_maps_directions",
      start_addr: q.from,
      end_addr: q.to,
      travel_mode: "3",
      hl: "en",
    });
    const route = (data.directions ?? []).find(
      (
        entry,
      ): entry is { duration: number; cost?: unknown; currency?: unknown; trips?: unknown[] } =>
        typeof entry === "object" &&
        entry !== null &&
        Number.isFinite((entry as { duration?: unknown }).duration) &&
        (entry as { duration: number }).duration > 0,
    );
    if (!route) throw new SerpApiError(`No transit route from ${q.from} to ${q.to}.`, "no_results");
    const amount = Number(route.cost);
    const services = (route.trips ?? []).flatMap((trip) => {
      const title = (trip as { title?: unknown; travel_mode?: unknown }).title;
      return (trip as { travel_mode?: unknown }).travel_mode === "Transit" &&
        typeof title === "string"
        ? [title]
        : [];
    });
    return {
      durationMin: Math.max(1, Math.ceil(route.duration / 60)),
      ...(Number.isFinite(amount) && amount > 0 && typeof route.currency === "string"
        ? { fare: { amount, currency: route.currency } }
        : {}),
      services,
    };
  });
}
