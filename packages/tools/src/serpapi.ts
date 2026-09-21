// Owner: C — SerpApi (Google Hotels + Google Flights) real-time price adapter.
//
// One SERPAPI_KEY, one shared monthly usage counter, one shared short-lived
// result cache, for both engines — per the actual request. Both live as
// module-level state here, same reliability tier as everything else this
// codebase persists today (see packages/services/src/memory/index.ts's own
// TODO to replace its in-memory Maps with a real store): this genuinely caps
// usage at MONTHLY_LIMIT/month on a long-lived process (local dev, `next
// start`), but each Vercel serverless cold start resets it, so in production
// it is a soft guard, not a hard one, until that durable-store work lands.
//
// Contract with SerpApi, verified against https://serpapi.com/google-hotels-api,
// https://serpapi.com/google-flights-api and (for the actual error shape,
// which neither doc page shows) an empirical request with a bad key:
// `{"error": "Invalid API key. ..."}` with HTTP 401.
import { durableStoreConfigured, jsonStore } from "@trip/services";
import type { FlightOption, StayOption } from "@trip/shared";
import { airportCodeFor } from "./airports";

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

// --- shared monthly quota, both engines count against the same total -------
let usage = { month: "", count: 0 };
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
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
/** Exported for tests and any future usage indicator; not part of BookingPort. */
export function serpApiUsage(): { month: string; count: number; limit: number } {
  rolloverIfNewMonth();
  return { ...usage, limit: MONTHLY_LIMIT };
}
/** Test-only: force the counter back to zero so tests don't leak into each other. */
export function resetSerpApiUsageForTests(): void {
  usage = { month: "", count: 0 };
}

// --- shared short-lived cache, both engines, so re-asking the same question
// during one planning session doesn't spend a second real search --------
const cache = new Map<string, { expiresAt: number; value: unknown }>();
async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (durableStoreConfigured()) {
    const stored = await jsonStore.get<{ expiresAt: number; value: T }>(
      `trip:serpapi:cache:${key}`,
    );
    if (stored && stored.expiresAt > Date.now()) return stored.value;
    const value = await fetcher();
    await jsonStore.set(`trip:serpapi:cache:${key}`, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      value,
    });
    return value;
  }
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const value = await fetcher();
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}
/** Test-only: cache entries would otherwise leak between test cases. */
export function clearSerpApiCacheForTests(): void {
  cache.clear();
}

function apiKey(): string {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new SerpApiError("SerpApi is not configured. Add SERPAPI_KEY.", "not_configured");
  return key;
}

interface SerpApiRaw {
  error?: string;
  properties?: unknown[];
  best_flights?: unknown[];
  other_flights?: unknown[];
}

async function serpApiSearch(params: Record<string, string>): Promise<SerpApiRaw> {
  const reservation = await reserveQuota();
  try {
    const url = new URL("https://serpapi.com/search.json");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("api_key", apiKey());

    let response: Response;
    try {
      response = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
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

// --- Google Hotels ----------------------------------------------------------

/** Google's place rating is 1.0-5.0; this project's convention is 0-10 —
 *  same conversion as the Google Places accommodation path, and the same
 *  reason it needs a test rather than trusting the schema range check. */
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
    const queriedAt = new Date().toISOString();
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
          // Not reliably exposed by this engine — same conservative default
          // as the Google Places path, for the same reason (see booking.ts).
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
          Number.isFinite(option.pricePerNight) && option.pricePerNight > 0,
      );
    if (options.length === 0) {
      throw new SerpApiError(`SerpApi returned no hotel results for ${q.city}.`, "no_results");
    }
    return options;
  });
}

// --- Google Flights ----------------------------------------------------------

// Verified empirically against a real key: SerpApi's Google Flights engine
// rejects a free-text city name outright —
// `departure_id ("Sydney") should either be an uppercase 3-letter code or
// start with "/m" or "/g"` — it does NOT resolve city names the way the
// Google Flights website does. This project's TripBrief only ever carries
// free-text city names (e.g. "Sydney"), never an airport code, so every real
// flight search needs this bridge. The table itself lives in ./airports.
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
    const queriedAt = new Date().toISOString();
    const flights = [...(data.best_flights ?? []), ...(data.other_flights ?? [])];
    const options: FlightOption[] = flights
      .map((raw): FlightOption => {
        const flight = raw as {
          price?: unknown;
          layovers?: unknown[];
          total_duration?: unknown;
          flights?: Array<{ airline?: unknown }>;
        };
        const airline = flight.flights?.[0]?.airline;
        const durationMin = Number(flight.total_duration);
        // SerpApi/Google Flights reports one price per passenger for the
        // whole itinerary (both legs already combined on a round trip); this
        // project's FlightOption convention (see booking.ts's header comment)
        // is a whole-group total, matching the mock fixtures — so it must be
        // scaled by passenger count here, or every group quote is silently
        // too low by a factor of `passengers`.
        const perPassenger = Number(flight.price);
        return {
          carrier: typeof airline === "string" ? airline.trim() : "",
          price: perPassenger * q.passengers,
          stops: Array.isArray(flight.layovers) ? flight.layovers.length : 0,
          ...(Number.isFinite(durationMin) ? { durationMin } : {}),
          provenance: {
            kind: "live",
            provider: "SerpApi Google Flights",
            queriedAt,
          },
          note: `${q.from} ${q.return ? "<->" : "->"} ${q.to}; ${q.passengers} passenger(s); ${q.return ? "round-trip" : "one-way"} group total in AUD; real-time SerpApi fare.`,
        };
      })
      .filter((option) => option.carrier.length > 0 && Number.isFinite(option.price) && option.price > 0);
    if (options.length === 0) {
      throw new SerpApiError(
        `SerpApi returned no flight results for ${q.from} to ${q.to}.`,
        "no_results",
      );
    }
    return options;
  });
}
