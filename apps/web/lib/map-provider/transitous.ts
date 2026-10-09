import { z } from "zod";
import { MapProviderUnavailableError } from "./errors";
import { providerCache, providerJson, type ProviderFetch } from "./http";
import type { Coordinates } from "./types";
import type { OsrmLeg } from "./osrm";

const itinerary = z.object({
  duration: z.number().positive(),
  legs: z.array(z.object({ mode: z.string() })),
});
const answer = z.object({ itineraries: z.array(itinerary) });
const TRANSIT = new Set([
  "TRAM",
  "SUBWAY",
  "FERRY",
  "AIRPLANE",
  "BUS",
  "COACH",
  "RAIL",
  "METRO",
  "HIGHSPEED_RAIL",
  "LONG_DISTANCE",
  "NIGHT_RAIL",
  "REGIONAL_RAIL",
  "SUBURBAN",
  "CABLE_CAR",
  "FUNICULAR",
  "AERIAL_LIFT",
  "OTHER",
]);
export function transitousClient(fetcher?: ProviderFetch) {
  const cache = providerCache<OsrmLeg>(60_000);
  return async (from: Coordinates, to: Coordinates, departure: string): Promise<OsrmLeg> => {
    const base = (process.env.TRANSITOUS_BASE_URL || "https://api.transitous.org").replace(
      /\/$/,
      "",
    );
    const url = new URL(`${base}/api/v6/plan`);
    Object.entries({
      fromPlace: `${from.latitude},${from.longitude}`,
      toPlace: `${to.latitude},${to.longitude}`,
      time: departure,
      numItineraries: "1",
      directModes: "",
      transitModes: "TRANSIT",
      preTransitModes: "WALK",
      postTransitModes: "WALK",
    }).forEach(([k, v]) => url.searchParams.set(k, v));
    return cache(url.href, async () => {
      const parsed = answer.safeParse(await providerJson(url.href, fetcher));
      if (!parsed.success) throw new MapProviderUnavailableError("osm", "upstream");
      const route = parsed.data.itineraries.find((r) =>
        r.legs.some((leg) => TRANSIT.has(leg.mode)),
      );
      return route
        ? { status: "ok", durationMin: Math.ceil(route.duration / 60) }
        : { status: "no_route" };
    });
  };
}
