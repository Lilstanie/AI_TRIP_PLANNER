import { afterEach, describe, expect, it, vi } from "vitest";
import { weather } from "../src/weather";

const query = {
  location: { latitude: -33.86, longitude: 151.2 },
  targetDate: "2026-10-01",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("weather provider", () => {
  it("returns a forecast within the fourteen-day boundary in mock mode", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T00:00:00.000Z"));

    const result = await weather.forecast(query);

    expect(result.horizon).toBe("forecast");
    expect(result.provider).toBe("Mock weather fixture");
    expect(result.validUntil).toBe("2026-10-02T00:00:00.000Z");
  });

  it("returns climate context after fourteen days and never calls the network in mock mode", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T00:00:00.000Z"));
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const result = await weather.forecast({ ...query, targetDate: "2026-10-10" });

    expect(result.horizon).toBe("climate");
    expect(result.summary).toContain("not a forecast");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reads the requested date from the official Google Weather daily forecast response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T00:00:00.000Z"));
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("WEATHER_API_KEY", "weather-test-key");
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        forecastDays: [
          {
            displayDate: { year: 2026, month: 10, day: 1 },
            daytimeForecast: { weatherCondition: { description: { text: "Sunny" } } },
            maxTemperature: { degrees: 24 },
            minTemperature: { degrees: 14 },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetcher);

    const result = await weather.forecast(query);

    expect(result).toMatchObject({
      horizon: "forecast",
      provider: "Google Weather API",
      summary: "Sunny, 14–24°C. Forecast conditions can change before departure.",
    });
    expect(String(fetcher.mock.calls[0]![0])).toContain(
      "weather.googleapis.com/v1/forecast/days:lookup",
    );
    expect(String(fetcher.mock.calls[0]![0])).toContain("location.latitude=-33.86");
  });

  it("keeps days eleven through fourteen as forecast with the extended provider", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T00:00:00.000Z"));
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        daily: {
          time: ["2026-10-04"],
          weather_code: [61],
          temperature_2m_max: [22],
          temperature_2m_min: [13],
        },
      }),
    });
    vi.stubGlobal("fetch", fetcher);

    const result = await weather.forecast({ ...query, targetDate: "2026-10-04" });

    expect(result).toMatchObject({
      horizon: "forecast",
      provider: "Open-Meteo Forecast API",
      summary: "Rain showers (13–22°C). Forecast conditions can change before departure.",
    });
    expect(String(fetcher.mock.calls[0]![0])).toContain("forecast_days=14");
  });

  it("surfaces provider failures instead of turning them into a forecast", async () => {
    // The query's target date must still be ahead, or validation rejects it before the provider is called.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T00:00:00.000Z"));
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("WEATHER_API_KEY", "weather-test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(weather.forecast(query)).rejects.toThrow("503");
  });
});
