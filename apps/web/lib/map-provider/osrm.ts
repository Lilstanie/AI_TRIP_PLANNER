import type { RouteMode, RouteResult } from "@/lib/integrations/google";
import { MapProviderUnavailableError } from "./errors";
import type { Coordinates } from "./types";

/**
 * Walking and driving times from OSRM. The public demo server (`router.project-osrm.org`) routes cars
 * only and ignores the profile it is asked for, so walking has its own foot-capable instance. Cycling
 * waits for a leg mode: legs today are walk, transit or drive.
 */
const DEFAULT_CAR_BASE = "https://router.project-osrm.org";
const DEFAULT_FOOT_BASE = "https://routing.openstreetmap.de/routed-foot";
const DEFAULT_USER_AGENT = "AI-Trip-Planner/0.1 (local development; contact@example.com)";
/** How long an answered leg is reused: the free servers ask for caching, and a day re-routes often. */
const CACHE_MS = 10 * 60_000;
const CACHE_LIMIT = 500;
const TIMEOUT_MS = 8_000;

type OsrmProfile = { base: string; profile: "foot" | "driving" };

/** The OSRM instance and profile a mode is routed on, from `OSRM_FOOT_BASE_URL` and `OSRM_BASE_URL`. */
function profileFor(mode: RouteMode): OsrmProfile {
  if (mode === "WALK")
    return { base: process.env.OSRM_FOOT_BASE_URL || DEFAULT_FOOT_BASE, profile: "foot" };
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
  const cache = new Map<string, { at: number; leg: OsrmLeg }>();
  return async (mode, from, to) => {
    const { base, profile } = profileFor(mode);
    const points = [from, to].map((p) => `${p.longitude},${p.latitude}`).join(";");
    const url = `${base.replace(/\/$/, "")}/route/v1/${profile}/${points}?overview=full&geometries=polyline&alternatives=false&steps=false`;
    const hit = cache.get(url);
    if (hit && now() - hit.at < CACHE_MS) return hit.leg;
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: { "user-agent": process.env.OSM_USER_AGENT || DEFAULT_USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      const name = (error as { name?: unknown } | null)?.name;
      throw new MapProviderUnavailableError(
        "osm",
        name === "TimeoutError" || name === "AbortError" ? "timeout" : "upstream",
      );
    }
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
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(url, { at: now(), leg });
    return leg;
  };
}
