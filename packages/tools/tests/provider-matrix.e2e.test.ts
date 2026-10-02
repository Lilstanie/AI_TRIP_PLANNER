// End-to-end contract for the provider policy visible through ToolGateway (#127).
//
// Failure inventory, written before implementation:
// - a gateway changes from fixture to live, or between live providers, after construction;
// - fixture mode reaches the network;
// - explicit and credential-derived Maps selection disagree with the current policy;
// - a missing credential fails gateway construction instead of the capability that needs it;
// - unsupported Maps capabilities are silently substituted;
// - accommodation loses its SerpApi -> Google Places fallback or its provenance;
// - flight failure is replaced with a fictional fare;
// - weather crosses the 10-day or 14-day provider boundary incorrectly;
// - concurrent gateways see each other's runtime configuration;
// - the matrix produces no stable artifact a reviewer can inspect.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createToolGatewayWithRuntime, snapshotToolRuntime } from "../src/gateway-internal";

interface MatrixEvidence {
  id: string;
  selection: string;
  result: string;
  fallback?: string;
  diagnostic?: string;
  provenance?: string;
}

const evidence: MatrixEvidence[] = [];
const artifactPath = resolve(
  process.cwd(),
  "../../output/e2e/tool-gateway-provider-matrix/summary.json",
);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ToolGateway provider matrix", () => {
  it("keeps one fixture policy after the environment changes", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "true");
    const fetcher = vi.fn(() => {
      throw new Error("fixture policy reached the network");
    });
    const gateway = createToolGatewayWithRuntime(snapshotToolRuntime(), {
      fetch: fetcher,
      now: () => new Date("2026-09-21T00:00:00.000Z"),
    });

    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "late-key");
    vi.stubEnv("SERPAPI_KEY", "late-key");

    const [routes, stays, flights, weather] = await Promise.all([
      gateway.maps.route({ from: "Tokyo", to: "Kyoto" }),
      gateway.booking.searchStays({
        city: "Tokyo",
        checkIn: "2026-10-01",
        checkOut: "2026-10-03",
        guests: 2,
      }),
      gateway.booking.searchFlights({
        from: "Sydney",
        to: "Tokyo",
        depart: "2026-10-01",
        passengers: 2,
      }),
      gateway.weather!.forecast({
        location: { latitude: -33.86, longitude: 151.2 },
        targetDate: "2026-10-01",
      }),
    ]);

    expect(routes[0]?.note).toContain("mock");
    expect(stays[0]?.provenance).toMatchObject({ kind: "mock" });
    expect(flights[0]?.provenance).toMatchObject({ kind: "mock" });
    expect(weather.provider).toBe("Mock weather fixture");
    expect(fetcher).not.toHaveBeenCalled();
    evidence.push({
      id: "fixture-isolation",
      selection: "fixture",
      result: "maps, stays, flights and weather stayed fixture",
      provenance: "mock",
    });
  });

  it("keeps one explicit Google policy, network and clock after globals change", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "captured-key");
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      Response.json({ routes: [{ duration: "3600s", distanceMeters: 120_000 }] }),
    );
    const gateway = createToolGatewayWithRuntime(snapshotToolRuntime(), {
      fetch: fetcher,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    vi.stubEnv("MAPS_PROVIDER", "osm");
    vi.stubEnv("MAPS_API_KEY", "");
    vi.setSystemTime(new Date("2026-10-03T00:00:00.000Z"));

    const [route] = await gateway.maps.route({
      from: "Tokyo",
      to: "Kyoto",
      departureTime: "2026-02-01T09:00:00+09:00",
    });

    expect(route).toMatchObject({ mode: "transit", durationMin: 60 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ "x-goog-api-key": "captured-key" }),
    });
    evidence.push({
      id: "explicit-google-snapshot",
      selection: "google",
      result: "transit route",
      provenance: "Google Maps request",
    });
  });

  it("keeps accommodation fallback distinct from flight failure", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "captured-maps-key");
    vi.stubEnv("SERPAPI_KEY", "captured-serp-key");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetcher = vi.fn(async (input: string | URL | Request) =>
      String(input).includes("serpapi.com")
        ? new Response(JSON.stringify({ error: "Invalid API key." }), { status: 401 })
        : Response.json({
            places: [{ displayName: { text: "Fallback Hotel" }, rating: 4.5 }],
          }),
    );
    const gateway = createToolGatewayWithRuntime(snapshotToolRuntime(), {
      fetch: fetcher,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    vi.stubEnv("MAPS_API_KEY", "");
    vi.stubEnv("SERPAPI_KEY", "");

    const [stay] = await gateway.booking.searchStays({
      city: "Tokyo",
      checkIn: "2026-02-01",
      checkOut: "2026-02-03",
      guests: 2,
    });
    const flightError = await gateway.booking
      .searchFlights({
        from: "Sydney",
        to: "Tokyo",
        depart: "2026-02-01",
        passengers: 2,
      })
      .catch((error: unknown) => error);

    expect(stay).toMatchObject({
      name: "Fallback Hotel",
      provenance: {
        kind: "estimated",
        provider: "Google Places estimate",
        fallbackFrom: "SerpApi Google Hotels",
        fallbackReason: "invalid_key",
      },
    });
    expect(flightError).toBeInstanceOf(Error);
    expect(String((flightError as Error).message)).not.toContain("MockAir");
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("falling back"));
    evidence.push({
      id: "booking-fallback-vs-flight-failure",
      selection: "SerpApi",
      result: "estimated stay; flight error",
      fallback: "SerpApi Google Hotels -> Google Places estimate",
      diagnostic: "invalid_key",
      provenance: stay?.provenance?.provider,
    });
  });

  it("keeps the 10-day and 14-day weather provider boundaries on the captured clock", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("WEATHER_API_KEY", "captured-weather-key");
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("weather.googleapis.com")) {
        return Response.json({
          forecastDays: [
            {
              displayDate: { year: 2026, month: 1, day: 5 },
              daytimeForecast: { weatherCondition: { description: { text: "Sunny" } } },
              maxTemperature: { degrees: 24 },
              minTemperature: { degrees: 14 },
            },
          ],
        });
      }
      if (url.includes("api.open-meteo.com/v1/forecast")) {
        return Response.json({
          daily: {
            time: ["2026-01-13"],
            weather_code: [61],
            temperature_2m_max: [22],
            temperature_2m_min: [13],
          },
        });
      }
      return Response.json({
        daily: {
          temperature_2m_max: [25],
          temperature_2m_min: [15],
          precipitation_sum: [0],
        },
      });
    });
    const gateway = createToolGatewayWithRuntime(snapshotToolRuntime(), {
      fetch: fetcher,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    vi.stubEnv("WEATHER_API_KEY", "");
    vi.setSystemTime(new Date("2026-10-03T00:00:00.000Z"));

    const query = { location: { latitude: -33.86, longitude: 151.2 } };
    const near = await gateway.weather!.forecast({ ...query, targetDate: "2026-01-05" });
    const extended = await gateway.weather!.forecast({ ...query, targetDate: "2026-01-13" });
    const climate = await gateway.weather!.forecast({ ...query, targetDate: "2026-02-01" });

    expect(near).toMatchObject({ provider: "Google Weather API", horizon: "forecast" });
    expect(extended).toMatchObject({
      provider: "Open-Meteo Forecast API",
      horizon: "forecast",
    });
    expect(climate).toMatchObject({
      provider: "Open-Meteo historical archive",
      horizon: "climate",
    });
    expect([near.observedAt, extended.observedAt, climate.observedAt]).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    ]);
    evidence.push({
      id: "weather-horizons",
      selection: "Google Weather <=10; Open-Meteo forecast 11-14; archive >14",
      result: "forecast, forecast, climate",
      provenance: [near.provider, extended.provider, climate.provider].join(" | "),
    });
  });

  it("defers missing credentials and unsupported capabilities until they are called", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "osm");
    vi.stubEnv("MAPS_API_KEY", "");
    vi.stubEnv("SERPAPI_KEY", "");
    const gateway = createToolGatewayWithRuntime(snapshotToolRuntime(), {
      fetch: vi.fn(),
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    const flightError = await gateway.booking
      .searchFlights({
        from: "Sydney",
        to: "Tokyo",
        depart: "2026-02-01",
        passengers: 1,
      })
      .catch((error: unknown) => error);
    const routeOptionsError = await gateway.maps.routeOptions!({
      from: "Tokyo",
      to: "Kyoto",
      departureTime: "2026-02-01T09:00:00+09:00",
    }).catch((error: unknown) => error);

    expect(flightError).toBeInstanceOf(Error);
    expect((flightError as Error).message).toContain("no SERPAPI_KEY");
    expect(routeOptionsError).toBeInstanceOf(Error);
    expect((routeOptionsError as Error).message).toContain("Unsupported maps provider: osm");
    evidence.push({
      id: "lazy-unavailable-capabilities",
      selection: "osm; no flight provider",
      result: "gateway constructed; calls rejected",
      diagnostic: "unsupported maps capability; missing SerpApi credential",
    });
  });

  it("isolates concurrent automatically-selected Google and explicit OSM gateways", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "");
    vi.stubEnv("MAPS_API_KEY", "auto-google-key");
    const googleFetch = vi.fn(async () =>
      Response.json({ routes: [{ duration: "1800s", distanceMeters: 20_000 }] }),
    );
    const google = createToolGatewayWithRuntime(snapshotToolRuntime(), {
      fetch: googleFetch,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    vi.stubEnv("MAPS_PROVIDER", "osm");
    vi.stubEnv("MAPS_API_KEY", "");
    const osmFetch = vi.fn(async (input: string | URL | Request) =>
      String(input).includes("route/v1")
        ? Response.json({ routes: [{ duration: 2400, distance: 30_000 }] })
        : Response.json([{ lat: "35", lon: "139", display_name: "place" }]),
    );
    const osm = createToolGatewayWithRuntime(snapshotToolRuntime(), {
      fetch: osmFetch,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    vi.stubEnv("MAPS_PROVIDER", "unsupported-after-construction");
    const [googleRoutes, osmRoutes] = await Promise.all([
      google.maps.route({
        from: "Tokyo",
        to: "Kyoto",
        departureTime: "2026-02-01T09:00:00+09:00",
      }),
      osm.maps.route({ from: "Tokyo", to: "Kyoto" }),
    ]);

    expect(googleRoutes[0]).toMatchObject({ mode: "transit", durationMin: 30 });
    expect(osmRoutes[0]?.note).toContain("OSRM driving-only");
    expect(googleFetch).toHaveBeenCalledTimes(1);
    expect(osmFetch).toHaveBeenCalledTimes(3);
    evidence.push({
      id: "concurrent-runtime-isolation",
      selection: "automatic google | explicit osm",
      result: "independent transit and OSRM routes",
    });
  });

  it("writes a stable provider-policy artifact", () => {
    expect(evidence.map((item) => item.id)).toEqual([
      "fixture-isolation",
      "explicit-google-snapshot",
      "booking-fallback-vs-flight-failure",
      "weather-horizons",
      "lazy-unavailable-capabilities",
      "concurrent-runtime-isolation",
    ]);
    const artifact = {
      schemaVersion: 1,
      suite: "tool-gateway-provider-matrix",
      capturedAt: "2026-01-01T00:00:00.000Z",
      cases: evidence,
    };
    mkdirSync(resolve(artifactPath, ".."), { recursive: true });
    writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

    expect(JSON.parse(readFileSync(artifactPath, "utf8"))).toEqual(artifact);
  });
});
