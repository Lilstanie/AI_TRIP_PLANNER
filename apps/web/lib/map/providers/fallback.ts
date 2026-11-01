import { GoogleNotConfiguredError, GoogleRequestError } from "@/lib/integrations/google";
import { providerOfPhotoName, providerOfPlaceId } from "./ids";
import type { MapProvider, UnavailableReason } from "./types";
import { GoogleSimulatedOutageError } from "./google";

type Unavailability = { reason: UnavailableReason; coolDown: boolean };

const REFUSED_KEY = new Set(["API_KEY_INVALID", "API_KEY_SERVICE_BLOCKED", "PERMISSION_DENIED"]);

export function googleUnavailability(error: unknown): Unavailability | undefined {
  if (error instanceof GoogleNotConfiguredError)
    return { reason: "not_configured", coolDown: false };
  if (error instanceof GoogleSimulatedOutageError) return { reason: "simulated", coolDown: false };
  if (error instanceof GoogleRequestError) {
    if (error.status === 401 || error.status === 403)
      return { reason: "access_denied", coolDown: true };
    if (error.status === 429) return { reason: "quota", coolDown: true };
    if (error.status === 400 && error.reason && REFUSED_KEY.has(error.reason))
      return { reason: "access_denied", coolDown: true };
    if (error.status >= 500) return { reason: "upstream", coolDown: false };
    return undefined;
  }

  const name = (error as { name?: unknown } | null)?.name;
  if (name === "TimeoutError" || name === "AbortError")
    return { reason: "timeout", coolDown: false };

  if (error instanceof TypeError && error.message === "fetch failed")
    return { reason: "upstream", coolDown: false };
  return undefined;
}

export type FallbackOptions = { cooldownMs: number; now?: () => number };

export function fallbackMapProvider(
  google: MapProvider,
  osm: MapProvider,
  { cooldownMs, now = Date.now }: FallbackOptions,
): MapProvider {
  let skipUntil = 0;
  let coolingFrom: unknown;

  async function askGoogle<T>(
    call: () => Promise<T>,
  ): Promise<{ answer: T } | { failure: unknown }> {
    if (now() < skipUntil) return { failure: coolingFrom };
    try {
      return { answer: await call() };
    } catch (error) {
      const unavailable = googleUnavailability(error);
      if (!unavailable) throw error;
      if (unavailable.coolDown) {
        skipUntil = now() + cooldownMs;
        coolingFrom = error;
      }
      return { failure: error };
    }
  }

  async function googleThenOsm<T>(
    google: () => Promise<T>,
    osm: (() => Promise<T>) | undefined,
  ): Promise<T> {
    const first = await askGoogle(google);
    if ("answer" in first) return first.answer;
    if (!osm) throw first.failure;
    try {
      return await osm();
    } catch {
      throw first.failure;
    }
  }

  return {
    searchPlaces: (query) =>
      googleThenOsm(
        () => google.searchPlaces(query),
        () => osm.searchPlaces(query),
      ),
    placeDetails: (id, language) =>
      providerOfPlaceId(id) === "osm"
        ? osm.placeDetails(id, language)
        : googleThenOsm(() => google.placeDetails(id, language), undefined),
    placePhoto: (name, width) =>
      providerOfPhotoName(name) === "osm"
        ? osm.placePhoto(name, width)
        : googleThenOsm(() => google.placePhoto(name, width), undefined),
    route: (from, to, departure, mode, hints) =>
      providerOfPlaceId(from) === "osm" || providerOfPlaceId(to) === "osm"
        ? osm.route(from, to, departure, mode, hints)
        : googleThenOsm(
            () => google.route(from, to, departure, mode, hints),
            () => osm.route(from, to, departure, mode, hints),
          ),
    routeFromLocation: (origin, to, mode, toLocation) =>
      providerOfPlaceId(to) === "osm"
        ? osm.routeFromLocation(origin, to, mode, toLocation)
        : googleThenOsm(
            () => google.routeFromLocation(origin, to, mode),
            () => osm.routeFromLocation(origin, to, mode, toLocation),
          ),
    timeZone: (place, date) =>
      googleThenOsm(
        () => google.timeZone(place, date),
        () => osm.timeZone(place, date),
      ),
  };
}
