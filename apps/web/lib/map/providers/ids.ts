import type { MapProviderId } from "./types";

export const providerOfPlaceId = (id: string): MapProviderId =>
  id.startsWith("osm:") ? "osm" : "google";

export const providerOfPhotoName = (name: string): MapProviderId =>
  name.startsWith("places/") ? "google" : "osm";
