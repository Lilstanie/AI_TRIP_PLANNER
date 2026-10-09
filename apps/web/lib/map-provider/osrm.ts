import type { RouteMode, RouteResult } from "@/lib/integrations/google";
import { MapProviderUnavailableError } from "./errors";
import type { Coordinates } from "./types";

import { providerCache, providerResponse } from "./http";

/** Separate OSRM deployments supply the correct foot, bicycle and car profiles. */
const DEFAULT_CAR_BASE = "https://router.project-osrm.org";
const DEFAULT_FOOT_BASE = "https://routing.openstreetmap.de/routed-foot";
const DEFAULT_BIKE_BASE = "https://routing.openstreetmap.de/routed-bike";

type OsrmProfile = { base: string; profile: "foot" | "driving" | "bike" };

/** The OSRM instance and profile a mode is routed on, from the foot, bike and car base URL settings. */
function profileFor(mode: RouteMode): OsrmProfile {
  if (mode === "WALK")
    return { base: process.env.OSRM_FOOT_BASE_URL || DEFAULT_FOOT_BASE, profile: "foot" };
  if (mode === "BICYCLE")
    return { base: process.env.OSRM_BIKE_BASE_URL || DEFAULT_BIKE_BASE, profile: "bike" };
  if (mode === "DRIVE")
    return { base: process.env.OSRM_BASE_URL || DEFAULT_CAR_BASE, profile: "driving" };
  // Public transport is Transitous's (ticket #276), never an OSRM guess.
  throw new MapProviderUnavailableError("osm", "not_supported");
}

export type OsrmLeg = Pick<RouteResult, "status" | "durationMin" | "distanceMeters" | "polyline">;

export type OsrmClient = (mode: RouteMode, from: Coordinates, to: Coordinates) => Promise<OsrmLeg>;

/**
 * An OSRM client with a short in-memory cache of answered legs. `NoRoute` is an answer; a server
 * error, timeout, network failure or an answer without a duration throws `MapProviderUnavailableError`
 * and is not cached.
 */
export function osrmClient({
  fetch: fetcher = fetch,
  now = Date.now,
}: {
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  now?: () => number;
} = {}): OsrmClient {
  const cached = providerCache<OsrmLeg>(600_000, now);
  return async (mode, from, to) => {
    const { base, profile } = profileFor(mode);
    const points = [from, to].map((p) => `${p.longitude},${p.latitude}`).join(";");
    const url = `${base.replace(/\/$/, "")}/route/v1/${profile}/${points}?overview=full&geometries=polyline&alternatives=false&steps=false`;
    return cached(url, async () => {
      const response = await providerResponse(url, fetcher);
      const body = (await response.json().catch(() => undefined)) as
        | {
            code?: string;
            routes?: { duration?: unknown; distance?: unknown; geometry?: unknown }[];
          }
        | undefined;
      let leg: OsrmLeg;
      if (body?.code === "NoRoute" || body?.code === "NoSegment") leg = { status: "no_route" };
      else {
        const route = response.ok ? body?.routes?.[0] : undefined;
        const seconds = Number(route?.duration);
        if (!route || route.duration === undefined || !Number.isFinite(seconds) || seconds < 0)
          throw new MapProviderUnavailableError("osm", "upstream");
        const distance = Number(route.distance);
        leg = {
          status: "ok",
          durationMin: Math.max(1, Math.ceil(seconds / 60)),
          ...(Number.isFinite(distance) ? { distanceMeters: Math.round(distance) } : {}),
          ...(typeof route.geometry === "string" ? { polyline: route.geometry } : {}),
        };
      }
      return leg;
    });
  };
}
