import type { ToolGateway } from "@trip/shared";
import * as bookingAdapter from "./booking";
import { runWithDataMode } from "./data-mode";
import * as mapsAdapter from "./maps";
import {
  defaultToolRuntimeDependencies,
  runWithToolRuntime,
  snapshotToolRuntime,
  type ToolRuntimeConfig,
  type ToolRuntimeDependencies,
} from "./runtime-context";
import * as weatherAdapter from "./weather";

export { snapshotToolRuntime } from "./runtime-context";
export type { ToolRuntimeConfig, ToolRuntimeDependencies } from "./runtime-context";

/** Internal deterministic construction seam; the package entry point exposes only createToolGateway. */
export function createToolGatewayWithRuntime(
  config: ToolRuntimeConfig,
  dependencies: ToolRuntimeDependencies = defaultToolRuntimeDependencies(),
): ToolGateway {
  const invoke = <T>(fn: () => T): T =>
    runWithDataMode(config.dataMode, () => runWithToolRuntime(config, dependencies, fn));

  return {
    maps: {
      route: (query) => invoke(() => mapsAdapter.route(query)),
      places: (query) => invoke(() => mapsAdapter.places(query)),
      routeOptions: (query) => invoke(() => mapsAdapter.routeOptions(query)),
    },
    booking: {
      searchStays: (query) => invoke(() => bookingAdapter.searchStays(query)),
      searchFlights: (query) => invoke(() => bookingAdapter.searchFlights(query)),
      searchReturnLeg: (query) => invoke(() => bookingAdapter.searchReturnLeg(query)),
    },
    weather: {
      forecast: (query) => invoke(() => weatherAdapter.weather.forecast(query)),
    },
  };
}

export function createToolGatewayFromCurrentRuntime(): ToolGateway {
  return createToolGatewayWithRuntime(snapshotToolRuntime());
}
