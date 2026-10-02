import { AsyncLocalStorage } from "node:async_hooks";
import { dataMode, type DataMode } from "./data-mode";

export interface ToolRuntimeConfig {
  readonly dataMode: DataMode;
  readonly mapsProvider: string;
  readonly mapsApiKey?: string;
  readonly mapsApiBaseUrl: string;
  readonly osmUserAgent?: string;
  readonly nominatimBaseUrl: string;
  readonly osrmBaseUrl: string;
  readonly serpApiKey?: string;
  readonly weatherApiKey?: string;
}

export interface ToolRuntimeDependencies {
  readonly fetch: typeof globalThis.fetch;
  readonly now: () => Date;
}

interface ToolRuntime {
  readonly config: ToolRuntimeConfig;
  readonly dependencies: ToolRuntimeDependencies;
}

const requestRuntime = new AsyncLocalStorage<ToolRuntime>();

const optional = (value: string | undefined): string | undefined => value || undefined;

/** Capture one immutable provider policy for a Planning Run. */
export function snapshotToolRuntime(): ToolRuntimeConfig {
  const mapsApiKey = optional(process.env.MAPS_API_KEY);
  return Object.freeze({
    dataMode: dataMode(),
    mapsProvider: process.env.MAPS_PROVIDER || (mapsApiKey ? "google" : "osm"),
    mapsApiKey,
    mapsApiBaseUrl: process.env.MAPS_API_BASE_URL || "https://routes.googleapis.com",
    osmUserAgent: optional(process.env.OSM_USER_AGENT),
    nominatimBaseUrl: process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org",
    osrmBaseUrl: process.env.OSRM_BASE_URL || "https://router.project-osrm.org",
    serpApiKey: optional(process.env.SERPAPI_KEY),
    weatherApiKey: optional(process.env.WEATHER_API_KEY) || mapsApiKey,
  });
}

export function defaultToolRuntimeDependencies(): ToolRuntimeDependencies {
  return Object.freeze({
    fetch: globalThis.fetch.bind(globalThis),
    now: () => new Date(),
  });
}

export function runWithToolRuntime<T>(
  config: ToolRuntimeConfig,
  dependencies: ToolRuntimeDependencies,
  fn: () => T,
): T {
  return requestRuntime.run({ config, dependencies }, fn);
}

function runtime(): ToolRuntime {
  return (
    requestRuntime.getStore() ?? {
      config: snapshotToolRuntime(),
      dependencies: defaultToolRuntimeDependencies(),
    }
  );
}

export function toolRuntimeConfig(): ToolRuntimeConfig {
  return runtime().config;
}

export function toolFetch(
  ...args: Parameters<typeof globalThis.fetch>
): ReturnType<typeof globalThis.fetch> {
  return runtime().dependencies.fetch(...args);
}

export function toolNow(): Date {
  return new Date(runtime().dependencies.now().getTime());
}
