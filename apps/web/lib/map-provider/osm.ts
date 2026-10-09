import { NoticeError } from "@/lib/i18n/notice";
import type { MapProvider, MapProviderId, UnavailableReason } from "./types";

/** A map provider could not answer at all, as opposed to answering "not found". */
export class MapProviderUnavailableError extends NoticeError {
  constructor(
    readonly provider: MapProviderId,
    readonly reason: UnavailableReason,
  ) {
    super({ key: "The map service is temporarily unavailable. Please retry." });
    this.name = "MapProviderUnavailableError";
  }
}

/**
 * The free OpenStreetMap-based provider (Photon and Nominatim, Wikimedia Commons, OSRM, Transitous,
 * an offline time zone). Spec #270's later tickets fill in each operation; until then each one
 * reports itself unavailable, so the fallback surfaces Google's own failure and nothing a traveller
 * sees changes.
 */
export function osmMapProvider(): MapProvider {
  const unsupported = async (): Promise<never> => {
    throw new MapProviderUnavailableError("osm", "not_supported");
  };
  return {
    searchPlaces: unsupported,
    placeDetails: unsupported,
    placePhoto: unsupported,
    route: unsupported,
    routeFromLocation: unsupported,
    timeZone: unsupported,
  };
}
