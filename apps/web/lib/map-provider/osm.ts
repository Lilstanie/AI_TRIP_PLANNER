import type { DataMode } from "@trip/tools";
import { NoticeError } from "@/lib/i18n/notice";
import type { RouteMode, RouteResult } from "@/lib/integrations/google";
import { MapProviderUnavailableError } from "./errors";
import { providerOfPlaceId } from "./ids";
import { mockOsrmFetch, mockPlaceFor } from "./mock-osm";
import { osrmClient, type OsrmClient } from "./osrm";
import { offlineTimeZone } from "./time-zone";
import type { Coordinates, MapPlace, MapProvider } from "./types";

export type OsmProviderOptions = {
  /** `mock` answers from fixtures and never opens a connection; anything else is live. */
  dataMode?: DataMode;
  /** Replaces `fetch`, for tests. */
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  now?: () => number;
  /** Coordinates of an OSM place id, for a caller that does not already hold them. */
  locate?: (id: string) => Promise<Coordinates | undefined>;
};

const unsupported = async (): Promise<never> => {
  throw new MapProviderUnavailableError("osm", "not_supported");
};

/**
 * The free OpenStreetMap-based provider. Walking and driving come from OSRM and the time zone is worked
 * out offline from coordinates; search, details and photos are still unsupported until their tickets
 * (#272, #275) land, so the fallback surfaces Google's own failure for them.
 */
export function osmMapProvider(options: OsmProviderOptions = {}): MapProvider {
  const mock = options.dataMode === "mock";
  const osrm: OsrmClient = osrmClient({
    fetch: options.fetch ?? (mock ? mockOsrmFetch : undefined),
    now: options.now,
  });
  const locate =
    options.locate ?? (async (id: string) => (mock ? mockPlaceFor(id)?.location : undefined));

  /** A place's coordinates: the caller's hint, else an OSM id looked up; a Google id is never looked up. */
  const locationOf = async (id: string, hint?: Coordinates) => {
    if (hint) return hint;
    return providerOfPlaceId(id) === "osm" ? locate(id) : undefined;
  };

  return {
    searchPlaces: unsupported,
    placePhoto: unsupported,
    placeDetails: async (id) => {
      const place = mock ? mockPlaceFor(id) : undefined;
      if (place) return { value: place, source: "osm" };
      if (mock) throw new NoticeError({ key: "This saved place is no longer available." });
      return unsupported();
    },
    route: async (from, to, _departure, mode, hints) => {
      const origin = await locationOf(from, hints?.fromLocation);
      const destination = await locationOf(to, hints?.toLocation);
      if (!origin || !destination) return unsupported();
      return routeResult(from, to, mode, await osrm(mode, origin, destination));
    },
    routeFromLocation: async (origin, to, mode) => {
      const destination = await locationOf(to);
      if (!destination) return unsupported();
      return routeResult("current-location", to, mode, await osrm(mode, origin, destination));
    },
    timeZone: async (place: MapPlace) => ({ value: offlineTimeZone(place), source: "osm" }),
  };
}

function routeResult(
  from: string,
  to: string,
  mode: RouteMode,
  leg: Omit<RouteResult, "from" | "to" | "mode" | "source">,
): RouteResult {
  return { from, to, mode, source: "osrm", ...leg };
}
