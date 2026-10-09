import type { GooglePlace, PhotoWidth, RouteMode, RouteResult } from "@/lib/integrations/google";

/** Who answered a map call. Ids carry it too: `osm:node/1` is OpenStreetMap, an unprefixed id Google. */
export type MapProviderId = "google" | "osm";

/** The server setting `WEB_MAPS_PROVIDER`: which providers the web workspace may ask, in order. */
export type MapProviderSetting = "google-with-fallback" | "google" | "osm";

/**
 * A place as the workspace shows it, whichever provider found it. Today this is Google's shape; an
 * OSM place fills the same fields it has and leaves the rest (rating, photos it cannot link) absent.
 */
export type MapPlace = GooglePlace;

/** An answer and the provider that gave it, so a response can say where its data came from. */
export type Answered<T> = { value: T; source: MapProviderId };

export type PlaceSearch = {
  text: string;
  /** The trip's destination, to narrow the search to it ("To-ji Temple" + "Kyoto"). */
  destination?: string;
  /** The interface language (`en`, `zh`), for providers that can name places in it. */
  language?: string;
};

export type Coordinates = { latitude: number; longitude: number };

export type RouteHints = { fromLocation?: Coordinates; toLocation?: Coordinates };

/**
 * Every map call the web workspace makes. A method throws when its provider could not answer; the
 * fallback provider decides from what was thrown whether another provider should try. A route that
 * the provider answered without a route between the places is `status: "no_route"`, not a throw.
 */
export interface MapProvider {
  searchPlaces(query: PlaceSearch): Promise<Answered<MapPlace[]>>;
  placeDetails(id: string, language?: "en" | "zh"): Promise<Answered<MapPlace>>;
  /** A short-lived image URL to redirect the browser to, for a photo name from a place lookup. */
  placePhoto(name: string, width: PhotoWidth): Promise<Answered<string>>;
  /**
   * One leg between two saved places (provider-scoped ids), leaving at `departure`. `hints` carries
   * coordinates a caller already holds, so a provider that cannot read the other provider's ids can
   * still route between them.
   */
  route(
    from: string,
    to: string,
    departure: string,
    mode: RouteMode,
    hints?: RouteHints,
  ): Promise<RouteResult>;
  /** The traveller's current position to a saved place, leaving now. Coordinates are never stored. */
  routeFromLocation(
    origin: Coordinates,
    to: string,
    mode: "WALK" | "TRANSIT",
    toLocation?: Coordinates,
  ): Promise<RouteResult>;
  /** The IANA time zone at a place on a date. */
  timeZone(place: MapPlace, date: string): Promise<Answered<string>>;
}

/** Why a provider could not answer. Only Google's access and quota failures start a cool-down. */
export type UnavailableReason =
  | "not_configured"
  | "access_denied"
  | "quota"
  | "upstream"
  | "timeout"
  | "simulated"
  | "not_supported";
