import tzlookup from "@photostructure/tz-lookup";
import { NoticeError } from "@/lib/i18n/notice";
import type { MapPlace } from "./types";

/**
 * The IANA time zone at a place, worked out from its coordinates with no network call
 * (`@photostructure/tz-lookup`). Its borders are simplified, so a point within a few kilometres of a
 * zone border can get the neighbouring zone; a trip stop is rarely that close. A place without
 * coordinates has no zone: assuming UTC would put every leg's departure hours off.
 */
export function offlineTimeZone(place: MapPlace): string {
  if (!place.location) throw new NoticeError({ key: "This place has no verified coordinates." });
  const { latitude, longitude } = place.location;
  try {
    return tzlookup(latitude, longitude);
  } catch {
    throw new NoticeError({ key: "Destination time zone could not be verified." });
  }
}
