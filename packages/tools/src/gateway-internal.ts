import type { ToolGateway } from "@trip/shared";
import { createBookingPort } from "./booking-port";
import { runWithDataMode } from "./data-mode";
import { createMapsPort } from "./maps-port";
import { createWeatherPort } from "./weather-port";
import {
  defaultToolRuntimeDependencies,
  runWithToolRuntime,
  type ToolRuntimeConfig,
  type ToolRuntimeDependencies,
} from "./runtime-context";

export { snapshotToolRuntime } from "./runtime-context";
export type { ToolRuntimeConfig, ToolRuntimeDependencies } from "./runtime-context";

/** Internal deterministic construction seam; the package entry point exposes only createToolGateway. */
export function createToolGatewayWithRuntime(
  config: ToolRuntimeConfig,
  dependencies: ToolRuntimeDependencies = defaultToolRuntimeDependencies(),
): ToolGateway {
  const invoke = <T>(fn: () => T): T =>
    runWithDataMode(config.dataMode, () => runWithToolRuntime(config, dependencies, fn));
  const mapsPort = createMapsPort(config, true);
  const bookingPort = createBookingPort(config, true);
  const weatherPort = createWeatherPort(config, dependencies);

  return {
    maps: {
      route: (query) => invoke(() => mapsPort.route(query)),
      places: (query) => invoke(() => mapsPort.places(query)),
      routeOptions: (query) => invoke(() => mapsPort.routeOptions!(query)),
    },
    booking: {
      searchStays: (query) => invoke(() => bookingPort.searchStays(query)),
      searchFlights: (query) => invoke(() => bookingPort.searchFlights(query)),
      searchReturnLeg: (query) => invoke(() => bookingPort.searchReturnLeg!(query)),
    },
    weather: {
      forecast: (query) => invoke(() => weatherPort.forecast(query)),
    },
  };
}
