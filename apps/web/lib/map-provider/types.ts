import type { GooglePlace, PhotoWidth, RouteMode, RouteResult } from "@/lib/integrations/google";

export type MapProviderId = "google" | "osm";

export type MapProviderSetting = "google-with-fallback" | "google" | "osm";

export type MapPlace = GooglePlace;

export type Answered<T> = { value: T; source: MapProviderId };

export type PlaceSearch = {
  text: string;

  autocomplete?: boolean;

  destination?: string;

  language?: string;
};

export type Coordinates = { latitude: number; longitude: number };

export type RouteHints = { fromLocation?: Coordinates; toLocation?: Coordinates };

export interface MapProvider {
  searchPlaces(query: PlaceSearch): Promise<Answered<MapPlace[]>>;
  placeDetails(id: string, language?: "en" | "zh"): Promise<Answered<MapPlace>>;

  placePhoto(name: string, width: PhotoWidth): Promise<Answered<string>>;

  route(
    from: string,
    to: string,
    departure: string,
    mode: RouteMode,
    hints?: RouteHints,
  ): Promise<RouteResult>;

  routeFromLocation(
    origin: Coordinates,
    to: string,
    mode: "WALK" | "TRANSIT",
    toLocation?: Coordinates,
  ): Promise<RouteResult>;

  timeZone(place: MapPlace, date: string): Promise<Answered<string>>;
}

export type UnavailableReason =
  | "not_configured"
  | "access_denied"
  | "quota"
  | "upstream"
  | "timeout"
  | "simulated"
  | "not_supported";
