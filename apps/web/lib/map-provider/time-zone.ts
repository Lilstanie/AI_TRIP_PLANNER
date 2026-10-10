import tzlookup from "@photostructure/tz-lookup";
import { NoticeError } from "@/lib/i18n/notice";
import type { MapPlace } from "./types";

export function offlineTimeZone(place: MapPlace): string {
  if (!place.location) throw new NoticeError({ key: "This place has no verified coordinates." });
  const { latitude, longitude } = place.location;
  try {
    return tzlookup(latitude, longitude);
  } catch {
    throw new NoticeError({ key: "Destination time zone could not be verified." });
  }
}
