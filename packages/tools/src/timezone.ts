import tzlookup from "@photostructure/tz-lookup";

export type Coordinates = { latitude: number; longitude: number };

export function localCalendarDate(now: Date, location?: Coordinates): string {
  if (!location) return now.toISOString().slice(0, 10);
  try {
    const timezone = tzlookup(location.latitude, location.longitude);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
