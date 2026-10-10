import { configuredDataMode, parseDataMode, type DataMode } from "@trip/tools";
import { unavailableRoute, type RouteMode, type RouteResult } from "@/lib/integrations/google";
import { fallbackMapProvider } from "./fallback";
import { mockGoogleProvider } from "./mock-google";
import { googleMapProvider } from "./google";
import { osmMapProvider } from "./osm";
import type { Coordinates, MapProvider, MapProviderSetting, RouteHints } from "./types";

export type { MapProvider, MapProviderSetting } from "./types";

const SETTINGS: readonly MapProviderSetting[] = ["google-with-fallback", "google", "osm"];
const DEFAULT_COOLDOWN_SECONDS = 300;

export function mapProviderSetting(): MapProviderSetting {
  const value = process.env.WEB_MAPS_PROVIDER as MapProviderSetting | undefined;
  return value && SETTINGS.includes(value) ? value : "google-with-fallback";
}

export function mockUsesProvider(): boolean {
  return process.env.MOCK_GOOGLE_MAPS === "unavailable" || mapProviderSetting() === "osm";
}

function cooldownMs() {
  const seconds = Number(process.env.GOOGLE_MAPS_COOLDOWN_SECONDS);
  return (Number.isFinite(seconds) && seconds >= 0 ? seconds : DEFAULT_COOLDOWN_SECONDS) * 1000;
}

export type MapProviderOptions = {
  setting: MapProviderSetting;
  cooldownMs: number;
  now?: () => number;

  dataMode?: DataMode;

  osm?: MapProvider;
};

export function createMapProvider(options: MapProviderOptions): MapProvider {
  const osm = options.osm ?? osmMapProvider({ dataMode: options.dataMode });
  if (options.setting === "osm") return osm;
  const google =
    options.dataMode === "mock" && process.env.MOCK_GOOGLE_MAPS !== "unavailable"
      ? mockGoogleProvider()
      : googleMapProvider({
          simulateOutage:
            options.dataMode === "mock" && process.env.MOCK_GOOGLE_MAPS === "unavailable",
        });
  if (options.setting === "google") return google;
  return fallbackMapProvider(google, osm, { cooldownMs: options.cooldownMs, now: options.now });
}

const shared = new Map<string, MapProvider>();

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

export function resetMapProviders() {
  shared.clear();
}

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

export async function routeFromLocation(
  provider: MapProvider,
  origin: Coordinates,
  to: string,
  mode: "WALK" | "TRANSIT",
  toLocation?: Coordinates,
): Promise<RouteResult> {
  try {
    return await provider.routeFromLocation(origin, to, mode, toLocation);
  } catch (error) {
    return unavailableRoute({ from: "current-location", to, mode }, error);
  }
}
