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
            displayDate: { year: 2026, month: 9, day: 30 },
            daytimeForecast: { weatherCondition: { description: { text: "Sunny" } } },
            maxTemperature: { degrees: 24 },
            minTemperature: { degrees: 14 },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetcher);

    const result = await weather.forecast({ ...query, targetDate: "2026-09-30" });

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
    expect(String(fetcher.mock.calls[0]![0])).toContain("forecast_days=15");
  });

  it("surfaces provider failures instead of turning them into a forecast", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T00:00:00.000Z"));
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("WEATHER_API_KEY", "weather-test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(weather.forecast(query)).rejects.toThrow("503");
  });
});

describe("destination calendar forecast windows", () => {
  it.each([9, 10, 13, 14, 15])(
    "resolves offset %i with a provider that covers it",
    async (offset) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-21T00:00:00Z"));
      vi.stubEnv("USE_MOCK_TOOLS", "false");
      vi.stubEnv("WEATHER_API_KEY", "test");
      const day = (i: number) => new Date(Date.UTC(2026, 8, 21 + i)).toISOString().slice(0, 10);
      const fetcher = vi.fn(async (input: URL | string) => {
        const url = new URL(String(input));
        if (url.hostname.includes("googleapis"))
          return Response.json({
            forecastDays: Array.from({ length: 10 }, (_, i) => ({
              displayDate: { year: 2026, month: 9, day: 21 + i },
            })),
          });
        const count = Number(url.searchParams.get("forecast_days"));
        return Response.json({
          daily: {
            time: Array.from({ length: count || 7 }, (_, i) => day(i)),
            weather_code: Array(count).fill(0),
            temperature_2m_max: Array(count || 7).fill(22),
            temperature_2m_min: Array(count || 7).fill(12),
            precipitation_sum: Array(7).fill(0),
          },
        });
      });
      vi.stubGlobal("fetch", fetcher);
      const result = await weather.forecast({ ...query, targetDate: day(offset) });
      expect(result.horizon).toBe(offset <= 14 ? "forecast" : "climate");
      expect(result.provider).toBe(
        offset <= 9
          ? "Google Weather API"
          : offset <= 14
            ? "Open-Meteo Forecast API"
            : "Open-Meteo historical archive",
      );
    },
  );
  it("uses the destination day when UTC is still on the previous date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T15:30:00Z"));
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("WEATHER_API_KEY", "test");
    const fetcher = vi.fn(async (_input: URL | string) =>
      Response.json({ forecastDays: [{ displayDate: { year: 2026, month: 9, day: 30 } }] }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect((await weather.forecast({ ...query, targetDate: "2026-09-30" })).provider).toBe(
      "Google Weather API",
    );
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("googleapis");
  });

  it("uses the destination's Open-Meteo calendar at a UTC date boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T14:30:00Z"));
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    const fetcher = vi.fn(async (input: URL | string) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("timezone")).toBe("Australia/Sydney");
      return Response.json({
        daily: {
          time: ["2026-10-01"],
          weather_code: [0],
          temperature_2m_max: [23],
          temperature_2m_min: [12],
        },
      });
    });
    vi.stubGlobal("fetch", fetcher);

    const result = await weather.forecast({ ...query, targetDate: "2026-10-01" });

    expect(result).toMatchObject({
      horizon: "forecast",
      targetDate: "2026-10-01",
      provider: "Open-Meteo Forecast API",
      summary: "Clear sky (12–23°C). Forecast conditions can change before departure.",
    });
  });
});
