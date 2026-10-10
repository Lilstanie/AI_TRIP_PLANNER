import type { DataMode } from "@trip/tools";
import { NoticeError } from "@/lib/i18n/notice";
import type { RouteMode, RouteResult } from "@/lib/integrations/google";
import { MapProviderUnavailableError } from "./errors";
import { providerOfPlaceId } from "./ids";
import { mockOsrmFetch, mockPlaceFor, mockSearchPlaces, mockTransitFetch } from "./mock-osm";
import { osrmClient, type OsrmClient } from "./osrm";
import { osmPlaces } from "./osm-places";
import { commonsPhotos } from "./commons";
import { transitousClient } from "./transitous";
import { offlineTimeZone } from "./time-zone";
import type { Coordinates, MapPlace, MapProvider } from "./types";

export type OsmProviderOptions = {
  dataMode?: DataMode;

  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  now?: () => number;

  locate?: (id: string) => Promise<Coordinates | undefined>;
};

const unsupported = async (): Promise<never> => {
  throw new MapProviderUnavailableError("osm", "not_supported");
};

export function osmMapProvider(options: OsmProviderOptions = {}): MapProvider {
  const mock = options.dataMode === "mock";
  const osrm: OsrmClient = osrmClient({
    fetch: options.fetch ?? (mock ? mockOsrmFetch : undefined),
    now: options.now,
  });
  const places = osmPlaces(options.fetch);
  const photos = commonsPhotos(options.fetch);
  const transit = transitousClient(options.fetch ?? (mock ? mockTransitFetch : undefined));
  const locate =
    options.locate ??
    (async (id: string) =>
      mock ? mockPlaceFor(id)?.location : (await places.details(id)).location);

  const locationOf = async (id: string, hint?: Coordinates) => {
    if (hint) return hint;
    return providerOfPlaceId(id) === "osm" ? locate(id) : undefined;
  };

  return {
    searchPlaces: async (query) => ({
      value: mock ? mockSearchPlaces(query.text) : await places.search(query),
      source: "osm",
    }),
    placePhoto: async (name, width) => {
      if (mock) {
        if (name !== "osm:fixture/Toji") throw new NoticeError({ key: "Unknown photo." });
        return {
          value: "/api/places/photo?name=osm%3Afixture%2FToji&width=400&fixture=1",
          source: "osm",
        };
      }
      return { value: await photos.url(name, width), source: "osm" };
    },
    placeDetails: async (id, language) => {
      const place = mock ? mockPlaceFor(id) : await places.details(id, language);
      if (!place) throw new NoticeError({ key: "This saved place is no longer available." });
      return { value: mock ? place : await photos.enrich(place), source: "osm" };
    },
    route: async (from, to, departure, mode, hints) => {
      const origin = await locationOf(from, hints?.fromLocation);
      const destination = await locationOf(to, hints?.toLocation);
      if (!origin || !destination) return unsupported();
      return {
        ...routeResult(
          from,
          to,
          mode,
          mode === "TRANSIT"
            ? await transit(origin, destination, departure)
            : await osrm(mode, origin, destination),
        ),
        source: mode === "TRANSIT" ? "transitous" : "osrm",
      };
    },
    routeFromLocation: async (origin, to, mode, toLocation) => {
      const destination = await locationOf(to, toLocation);
      if (!destination) return unsupported();
      return {
        ...routeResult(
          "current-location",
          to,
          mode,
          mode === "TRANSIT"
            ? await transit(origin, destination, new Date().toISOString())
            : await osrm(mode, origin, destination),
        ),
        source: mode === "TRANSIT" ? "transitous" : "osrm",
      };
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
