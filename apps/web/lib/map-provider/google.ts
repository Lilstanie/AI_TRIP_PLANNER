import {
  GoogleRequestError,
  placeDetails,
  placePhotoUri,
  requestGoogleRoute,
  requestGoogleRouteFromCoordinates,
  searchPlaces,
  timeZone,
} from "@/lib/integrations/google";
import type { MapProvider } from "./types";

/**
 * The simulated Google outage of mock data mode (`MOCK_GOOGLE_MAPS=unavailable`). A 503 so that,
 * when no other provider answers, the traveller reads the ordinary "temporarily unavailable" notice.
 */
export class GoogleSimulatedOutageError extends GoogleRequestError {
  constructor() {
    super(503, "SIMULATED_OUTAGE");
    this.name = "GoogleSimulatedOutageError";
  }
}

/** Google Maps Platform, as `lib/integrations/google.ts` calls it. Failures are thrown unchanged. */
export function googleMapProvider(options: { simulateOutage?: boolean } = {}): MapProvider {
  const outage = async (): Promise<never> => {
    throw new GoogleSimulatedOutageError();
  };
  if (options.simulateOutage)
    return {
      searchPlaces: outage,
      placeDetails: outage,
      placePhoto: outage,
      route: outage,
      routeFromLocation: outage,
      timeZone: outage,
    };
  return {
    searchPlaces: async ({ text, destination }) => ({
      value: await searchPlaces(text, destination),
      source: "google",
    }),
    placeDetails: async (id) => ({ value: await placeDetails(id), source: "google" }),
    placePhoto: async (name, width) => ({
      value: await placePhotoUri(name, width),
      source: "google",
    }),
    route: async (from, to, departure, mode) => ({
      ...(await requestGoogleRoute(from, to, departure, mode)),
      source: "google",
    }),
    routeFromLocation: async (origin, to, mode) => ({
      ...(await requestGoogleRouteFromCoordinates(origin, to, mode)),
      source: "google",
    }),
    timeZone: async (place, date) => ({ value: await timeZone(place, date), source: "google" }),
  };
}
