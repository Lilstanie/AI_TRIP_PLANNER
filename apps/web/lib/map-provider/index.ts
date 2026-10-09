import { configuredDataMode, parseDataMode, type DataMode } from "@trip/tools";
import { unavailableRoute, type RouteMode, type RouteResult } from "@/lib/integrations/google";
import { fallbackMapProvider } from "./fallback";
import { googleMapProvider } from "./google";
import { osmMapProvider } from "./osm";
import type { Coordinates, MapProvider, MapProviderSetting, RouteHints } from "./types";

export type { MapProvider, MapProviderSetting } from "./types";

const SETTINGS: readonly MapProviderSetting[] = ["google-with-fallback", "google", "osm"];
const DEFAULT_COOLDOWN_SECONDS = 300;

/** `WEB_MAPS_PROVIDER`; anything unknown or unset is the default, Google with the OSM fallback. */
export function mapProviderSetting(): MapProviderSetting {
  const value = process.env.WEB_MAPS_PROVIDER as MapProviderSetting | undefined;
  return value && SETTINGS.includes(value) ? value : "google-with-fallback";
}

/**
 * Whether a mock-data-mode request may still use the map provider. It may only when no Google call can
 * happen: Google is simulated down (`MOCK_GOOGLE_MAPS=unavailable`) or the setting is OSM alone. Otherwise
 * a mock edit keeps its placeholder fixtures and never reaches Google.
 */
export function mockUsesProvider(): boolean {
  return process.env.MOCK_GOOGLE_MAPS === "unavailable" || mapProviderSetting() === "osm";
}

/** `GOOGLE_MAPS_COOLDOWN_SECONDS`: how long Google is skipped after an access or quota failure. */
function cooldownMs() {
  const seconds = Number(process.env.GOOGLE_MAPS_COOLDOWN_SECONDS);
  return (Number.isFinite(seconds) && seconds >= 0 ? seconds : DEFAULT_COOLDOWN_SECONDS) * 1000;
}

export type MapProviderOptions = {
  setting: MapProviderSetting;
  cooldownMs: number;
  now?: () => number;
  /** The request's data mode; `MOCK_GOOGLE_MAPS=unavailable` is honoured only in `mock`. */
  dataMode?: DataMode;
  /** Replaces the OSM provider, for tests. */
  osm?: MapProvider;
};

/** The provider for a setting. The fallback's cool-down lives in the returned object. */
export function createMapProvider(options: MapProviderOptions): MapProvider {
  const osm = options.osm ?? osmMapProvider({ dataMode: options.dataMode });
  if (options.setting === "osm") return osm;
  const google = googleMapProvider({
    simulateOutage: options.dataMode === "mock" && process.env.MOCK_GOOGLE_MAPS === "unavailable",
  });
  if (options.setting === "google") return google;
  return fallbackMapProvider(google, osm, { cooldownMs: options.cooldownMs, now: options.now });
}

// One provider per data mode for the server process, so the cool-down outlives a single request.
const shared = new Map<string, MapProvider>();

/**
 * The map provider for a request, from `WEB_MAPS_PROVIDER` and the request's data mode (its
 * `x-trip-data-mode` header, else `USE_MOCK_TOOLS`).
 */
export function mapProvider(request?: Request): MapProvider {
  const dataMode = parseDataMode(request?.headers.get("x-trip-data-mode")) ?? configuredDataMode();
  const setting = mapProviderSetting();
  const key = `${setting}|${dataMode}|${process.env.MOCK_GOOGLE_MAPS ?? ""}`;
  let provider = shared.get(key);
  if (!provider) {
    provider = createMapProvider({ setting, cooldownMs: cooldownMs(), dataMode });
    shared.set(key, provider);
  }
  return provider;
}

/** Forget every provider and its cool-down. For tests. */
export function resetMapProviders() {
  shared.clear();
}

/** A leg that never throws: a provider failure becomes an `unavailable` route with its notice. */
export async function routeLeg(
  provider: MapProvider,
  from: string,
  to: string,
  departure: string,
  mode: RouteMode,
  hints?: RouteHints,
): Promise<RouteResult> {
  try {
    return await provider.route(from, to, departure, mode, hints);
  } catch (error) {
    return unavailableRoute({ from, to, mode }, error);
  }
}

/** The route from the traveller's position; a provider failure becomes an `unavailable` route. */
export async function routeFromLocation(
  provider: MapProvider,
  origin: Coordinates,
  to: string,
  mode: "WALK" | "TRANSIT",
): Promise<RouteResult> {
  try {
    return await provider.routeFromLocation(origin, to, mode);
  } catch (error) {
    return unavailableRoute({ from: "current-location", to, mode }, error);
  }
}
