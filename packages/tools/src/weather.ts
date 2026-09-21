import type { WeatherPort, WeatherQuery, WeatherResult } from "@trip/shared";
import { mockEnabled } from "./data-mode";

const DAY_MS = 86_400_000;
const FORECAST_LIMIT_DAYS = 14;
const GOOGLE_FORECAST_LIMIT_DAYS = 10;

function dateValue(value: string): number {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  )
    throw new Error(`Weather requires a valid YYYY-MM-DD target date: ${value}`);
  return timestamp;
}

function daysUntil(targetDate: string): number {
  return Math.floor((dateValue(targetDate) - dateValue(new Date().toISOString().slice(0, 10))) / DAY_MS);
}

function climateFixture(targetDate: string, latitude: number, provider: string): WeatherResult {
  const month = Number(targetDate.slice(5, 7));
  const southern = latitude < 0;
  const warm = southern ? [12, 1, 2].includes(month) : [6, 7, 8].includes(month);
  return {
    horizon: "climate",
    targetDate,
    summary: `${warm ? "Warm" : "Cooler"} seasonal climate context for the destination; historical planning guidance only, not a forecast.`,
    observedAt: new Date().toISOString(),
    provider,
  };
}

function mockWeather({ targetDate, location }: WeatherQuery): WeatherResult {
  const days = daysUntil(targetDate);
  if (days > FORECAST_LIMIT_DAYS) return climateFixture(targetDate, location.latitude, "Mock climate fixture");
  return {
    horizon: "forecast",
    targetDate,
    summary: "Mostly clear with a mild daytime temperature; carry a light layer and check conditions again before departure.",
    observedAt: new Date().toISOString(),
    validUntil: new Date(dateValue(targetDate) + DAY_MS).toISOString(),
    provider: "Mock weather fixture",
  };
}

type GoogleForecast = {
  forecastDays?: Array<{
    displayDate?: { year?: number; month?: number; day?: number };
    daytimeForecast?: { weatherCondition?: { description?: { text?: string } } };
    maxTemperature?: { degrees?: number };
    minTemperature?: { degrees?: number };
  }>;
};

type OpenMeteoForecast = {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

function weatherCodeDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain showers";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";
  return "Conditions unavailable";
}

async function googleForecast(query: WeatherQuery): Promise<WeatherResult> {
  const key = process.env.WEATHER_API_KEY || process.env.MAPS_API_KEY;
  if (!key) throw new Error("Google Weather API requires WEATHER_API_KEY or MAPS_API_KEY.");
  const url = new URL("https://weather.googleapis.com/v1/forecast/days:lookup");
  url.search = new URLSearchParams({
    key,
    "location.latitude": String(query.location.latitude),
    "location.longitude": String(query.location.longitude),
    unitsSystem: "METRIC",
    days: "10",
    pageSize: "10",
    languageCode: "en",
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Google Weather request failed (${response.status}).`);
  const data = (await response.json()) as GoogleForecast;
  const day = data.forecastDays?.find(
    (candidate) =>
      candidate.displayDate?.year === Number(query.targetDate.slice(0, 4)) &&
      candidate.displayDate?.month === Number(query.targetDate.slice(5, 7)) &&
      candidate.displayDate?.day === Number(query.targetDate.slice(8, 10)),
  );
  if (!day) throw new Error("Google Weather did not return the requested forecast date.");
  const condition = day.daytimeForecast?.weatherCondition?.description?.text ?? "Conditions unavailable";
  const high = day.maxTemperature?.degrees;
  const low = day.minTemperature?.degrees;
  const temperatures = Number.isFinite(high) && Number.isFinite(low) ? `, ${low}–${high}°C` : "";
  return {
    horizon: "forecast",
    targetDate: query.targetDate,
    summary: `${condition}${temperatures}. Forecast conditions can change before departure.`,
    observedAt: new Date().toISOString(),
    validUntil: new Date(dateValue(query.targetDate) + DAY_MS).toISOString(),
    provider: "Google Weather API",
  };
}

async function openMeteoForecast(query: WeatherQuery): Promise<WeatherResult> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(query.location.latitude),
    longitude: String(query.location.longitude),
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    forecast_days: String(FORECAST_LIMIT_DAYS),
    timezone: "UTC",
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Open-Meteo request failed (${response.status}).`);
  const data = (await response.json()) as OpenMeteoForecast;
  const daily = data.daily;
  const index = daily?.time?.indexOf(query.targetDate) ?? -1;
  const code = index >= 0 ? daily?.weather_code?.[index] : undefined;
  const high = index >= 0 ? daily?.temperature_2m_max?.[index] : undefined;
  const low = index >= 0 ? daily?.temperature_2m_min?.[index] : undefined;
  if (
    index < 0 ||
    !Number.isFinite(code) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low)
  ) {
    throw new Error("Open-Meteo did not return the requested forecast date.");
  }
  return {
    horizon: "forecast",
    targetDate: query.targetDate,
    summary: `${weatherCodeDescription(code!)} (${low}–${high}°C). Forecast conditions can change before departure.`,
    observedAt: new Date().toISOString(),
    validUntil: new Date(dateValue(query.targetDate) + DAY_MS).toISOString(),
    provider: "Open-Meteo Forecast API",
  };
}

export const weather: WeatherPort = {
  async forecast(query) {
    const days = daysUntil(query.targetDate);
    if (days < 0) throw new Error("Weather target date cannot be in the past.");
    if (days > FORECAST_LIMIT_DAYS) {
      return climateFixture(query.targetDate, query.location.latitude, "Seasonal climate fixture");
    }
    if (mockEnabled()) return mockWeather(query);
    return days <= GOOGLE_FORECAST_LIMIT_DAYS
      ? googleForecast(query)
      : openMeteoForecast(query);
  },
};

export { FORECAST_LIMIT_DAYS };
