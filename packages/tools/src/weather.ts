import type { WeatherPort } from "@trip/shared";
import { createWeatherPort, FORECAST_LIMIT_DAYS } from "./weather-port";
import { defaultToolRuntimeDependencies, snapshotToolRuntime } from "./runtime-context";

/** Temporary direct-adapter compatibility surface; new callers use ToolGateway. */
export const weather: WeatherPort = {
  forecast: (query) =>
    createWeatherPort(snapshotToolRuntime(), defaultToolRuntimeDependencies()).forecast(query),
};

export { FORECAST_LIMIT_DAYS };
