import { createContext } from "react";
import type { TripPlan } from "@trip/shared";
import type { GooglePlace } from "@/lib/integrations/google";
import { offlineTimeZone } from "@/lib/map-provider/time-zone";

export const OnTripContext = createContext<(onTrip: boolean | undefined) => void>(() => {});

export function onTripDay(
  dates: TripPlan["brief"]["dates"],
  destination: GooglePlace | undefined,
  now = new Date(),
): number | undefined {
  if (!destination?.location) return undefined;
  let timeZone: string;
  try {
    timeZone = offlineTimeZone(destination);
  } catch {
    return undefined;
  }
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const today = `${values.year}-${values.month}-${values.day}`;
  const start = Date.parse(`${dates[0]}T00:00:00.000Z`);
  const end = Date.parse(`${dates[1]}T00:00:00.000Z`);
  const current = Date.parse(`${today}T00:00:00.000Z`);
  if (current < start || current > end) return undefined;
  return Math.floor((current - start) / 86_400_000) + 1;
}
