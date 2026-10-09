import type { MapProviderId } from "./types";

/**
 * The provider that issued a saved place id. OSM ids are scoped (`osm:node/123`, `osm:way/456`,
 * `osm:relation/789`); an id without a prefix is a Google id, as every id saved before the fallback is.
 */
export const providerOfPlaceId = (id: string): MapProviderId =>
  id.startsWith("osm:") ? "osm" : "google";

/** The provider that issued a photo name: Google's are `places/{id}/photos/{id}`. */
export const providerOfPhotoName = (name: string): MapProviderId =>
  name.startsWith("places/") ? "google" : "osm";
