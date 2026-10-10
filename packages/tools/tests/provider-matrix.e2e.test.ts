import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createToolGatewayWithRuntime, snapshotToolRuntime } from "../src/gateway-internal";
import { clearSerpApiCacheForTests } from "../src/serpapi";

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
  clearSerpApiCacheForTests();
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
    const fetcher = vi.fn(async (input: string | URL | Request, _init?: RequestInit) =>
      String(input).includes("places.googleapis.com")
        ? Response.json({ places: [{ displayName: { text: "Sensoji Temple" } }] })
        : Response.json({ routes: [{ duration: "3600s", distanceMeters: 120_000 }] }),
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
    const [place] = await gateway.maps.places({ near: "Tokyo", category: "temple" });

    expect(route).toMatchObject({ mode: "transit", durationMin: 60 });
    expect(place).toMatchObject({ name: "Sensoji Temple", category: "temple" });
    expect(fetcher).toHaveBeenCalledTimes(2);
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

  it("keeps Google's empty-transit driving fallback", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "maps-key");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ routes: [] }))
      .mockResolvedValueOnce(
        Response.json({ routes: [{ duration: "2400s", distanceMeters: 30_000 }] }),
      );
    const gateway = createToolGatewayWithRuntime(snapshotToolRuntime(), {
      fetch: fetcher,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    const [route] = await gateway.maps.route({
      from: "Tokyo",
      to: "Kyoto",
      departureTime: "2026-02-01T09:00:00+09:00",
    });

    expect(route).toMatchObject({ mode: "drive", durationMin: 40 });
    expect(route?.note).toContain("no public transport route found");
    expect(fetcher).toHaveBeenCalledTimes(2);
    evidence.push({
      id: "google-driving-fallback",
      selection: "google",
      result: "driving route",
      fallback: "empty transit -> drive",
      provenance: "Google Maps driving route",
    });
  });

  it("keeps the inter-city SerpApi rail fallback", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "maps-key");
    vi.stubEnv("SERPAPI_KEY", "serp-key");
    const fetcher = vi.fn(async (input: string | URL | Request) =>
      String(input).includes("serpapi.com")
        ? Response.json({
            directions: [
              {
                duration: 8_400,
                cost: 14_170,
                currency: "JPY",
                trips: [{ travel_mode: "Transit", title: "Tokaido Shinkansen Nozomi 91" }],
              },
            ],
          })
        : Response.json({ routes: [] }),
    );
    const gateway = createToolGatewayWithRuntime(snapshotToolRuntime(), {
      fetch: fetcher,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    const [route] = await gateway.maps.route({
      from: "Tokyo Station",
      to: "Kyoto Station",
      departureTime: "2026-02-01T09:00:00+09:00",
      intercity: true,
      passengers: 2,
    });

    expect(route).toMatchObject({ mode: "train", durationMin: 140 });
    expect(route?.note).toContain("SerpApi");
    expect(fetcher).toHaveBeenCalledTimes(2);
    evidence.push({
      id: "google-intercity-rail-fallback",
      selection: "google + SerpApi",
      result: "priced train route",
      fallback: "empty Google transit -> SerpApi rail",
      provenance: "Google Maps transit via SerpApi",
    });
  });

  it("keeps a useful route option when its sibling provider call fails", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "maps-key");
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { travelMode?: string };
      return body.travelMode === "DRIVE"
        ? new Response("unavailable", { status: 503 })
        : Response.json({
            routes: [
              {
                duration: "3000s",
                travelAdvisory: { transitFare: { currencyCode: "AUD", units: "5" } },
                legs: [
                  {
                    steps: [
                      {
                        travelMode: "TRANSIT",
                        transitDetails: {
                          transitLine: { nameShort: "T1", vehicle: { type: "HEAVY_RAIL" } },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          });
    });
    const gateway = createToolGatewayWithRuntime(snapshotToolRuntime(), {
      fetch: fetcher,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    const options = await gateway.maps.routeOptions!({
      from: "Parramatta",
      to: "Sydney CBD",
      departureTime: "2026-02-01T09:00:00+11:00",
    });

    expect(options).toEqual([
      expect.objectContaining({ mode: "train", durationMin: 50, price: 5 }),
    ]);
    evidence.push({
      id: "google-route-options-partial-success",
      selection: "google",
      result: "transit option retained",
      diagnostic: "driving request failed with 503",
      provenance: "Google Routes transit option",
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

  it("keeps SerpApi as the primary live provider for stays and flights", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "captured-maps-key");
    vi.stubEnv("SERPAPI_KEY", "captured-serp-key");
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("engine=google_hotels")) {
        return Response.json({
          properties: [
            {
              name: "Live Hotel",
              rate_per_night: { extracted_lowest: 650 },
              overall_rating: 4.7,
            },
          ],
        });
      }
      if (url.includes("engine=google_flights")) {
        return Response.json({
          best_flights: [{ price: 450, flights: [{ airline: "Qantas" }] }],
        });
      }
      throw new Error(`unexpected provider request: ${url}`);
    });
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
    const [flight] = await gateway.booking.searchFlights({
      from: "Sydney",
      to: "Tokyo",
      depart: "2026-02-01",
      passengers: 2,
    });

    expect(stay).toMatchObject({
      name: "Live Hotel",
      pricePerNight: 650,
      provenance: { kind: "live", provider: "SerpApi Google Hotels" },
    });
    expect(flight).toMatchObject({
      carrier: "Qantas",
      price: 900,
      provenance: { kind: "live", provider: "SerpApi Google Flights" },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    evidence.push({
      id: "booking-primary-success",
      selection: "SerpApi",
      result: "live stay and flight",
      provenance: "SerpApi Google Hotels | SerpApi Google Flights",
    });
  });

  it("keeps Google-only lodging available while flights stay unavailable", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "captured-maps-key");
    vi.stubEnv("SERPAPI_KEY", "");
    const fetcher = vi.fn(async () =>
      Response.json({
        places: [{ displayName: { text: "Estimated Hotel" }, rating: 4.4 }],
      }),
    );
    const gateway = createToolGatewayWithRuntime(snapshotToolRuntime(), {
      fetch: fetcher,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    vi.stubEnv("MAPS_API_KEY", "");

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
      name: "Estimated Hotel",
      provenance: { kind: "estimated", provider: "Google Places estimate" },
    });
    expect(flightError).toBeInstanceOf(Error);
    expect((flightError as Error).message).toContain("no SERPAPI_KEY");
    expect(fetcher).toHaveBeenCalledTimes(1);
    evidence.push({
      id: "booking-google-only-partial",
      selection: "Google Places stays; no flight provider",
      result: "estimated stay; flight unavailable",
      diagnostic: "missing SerpApi flight credential",
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
          forecastDays: [1, 11].map((day) => ({
            displayDate: { year: 2026, month: 1, day },
            daytimeForecast: { weatherCondition: { description: { text: "Sunny" } } },
            maxTemperature: { degrees: 24 },
            minTemperature: { degrees: 14 },
          })),
        });
      }
      if (url.includes("api.open-meteo.com/v1/forecast")) {
        return Response.json({
          daily: {
            time: ["2026-01-12", "2026-01-15"],
            weather_code: [61, 61],
            temperature_2m_max: [22, 22],
            temperature_2m_min: [13, 13],
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
    const dates = ["2026-01-01", "2026-01-11", "2026-01-12", "2026-01-15", "2026-01-16"];
    const results = await Promise.all(
      dates.map((targetDate) => gateway.weather!.forecast({ ...query, targetDate })),
    );

    expect(results.map(({ provider, horizon }) => [provider, horizon])).toEqual([
      ["Google Weather API", "forecast"],
      ["Google Weather API", "forecast"],
      ["Open-Meteo Forecast API", "forecast"],
      ["Open-Meteo Forecast API", "forecast"],
      ["Open-Meteo historical archive", "climate"],
    ]);
    expect(results.map(({ observedAt }) => observedAt)).toEqual(
      Array(5).fill("2026-01-01T00:00:00.000Z"),
    );
    expect(fetcher).toHaveBeenCalledTimes(7);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("key=captured-weather-key");
    evidence.push({
      id: "weather-horizons",
      selection: "Google Weather <=10; Open-Meteo forecast 11-14; archive >14",
      result: "forecast on days 0, 10, 11 and 14; climate on day 15",
      provenance: results.map(({ provider }) => provider).join(" | "),
    });
  });

  it("defers a missing Google Weather credential until the near-date capability is called", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_API_KEY", "");
    vi.stubEnv("WEATHER_API_KEY", "");
    const fetcher = vi.fn(async () =>
      Response.json({
        daily: {
          time: ["2026-01-13"],
          weather_code: [61],
          temperature_2m_max: [22],
          temperature_2m_min: [13],
        },
      }),
    );
    const gateway = createToolGatewayWithRuntime(snapshotToolRuntime(), {
      fetch: fetcher,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    vi.stubEnv("WEATHER_API_KEY", "late-key");

    const extended = await gateway.weather!.forecast({
      location: { latitude: -33.86, longitude: 151.2 },
      targetDate: "2026-01-13",
    });
    const nearError = await gateway
      .weather!.forecast({
        location: { latitude: -33.86, longitude: 151.2 },
        targetDate: "2026-01-05",
      })
      .catch((error: unknown) => error);

    expect(extended).toMatchObject({ provider: "Open-Meteo Forecast API", horizon: "forecast" });
    expect(nearError).toBeInstanceOf(Error);
    expect((nearError as Error).message).toBe(
      "Google Weather API requires WEATHER_API_KEY or MAPS_API_KEY.",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    evidence.push({
      id: "weather-lazy-missing-credential",
      selection: "Google Weather unavailable; Open-Meteo forecast available",
      result: "extended forecast succeeds; near forecast rejects at call time",
      diagnostic: (nearError as Error).message,
      provenance: extended.provider,
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
    const stayError = await gateway.booking
      .searchStays({
        city: "Tokyo",
        checkIn: "2026-02-01",
        checkOut: "2026-02-03",
        guests: 1,
      })
      .catch((error: unknown) => error);
    const routeOptionsError = await gateway.maps.routeOptions!({
      from: "Tokyo",
      to: "Kyoto",
      departureTime: "2026-02-01T09:00:00+09:00",
    }).catch((error: unknown) => error);

    expect(flightError).toBeInstanceOf(Error);
    expect((flightError as Error).message).toContain("no SERPAPI_KEY");
    expect(stayError).toBeInstanceOf(Error);
    expect((stayError as Error).message).toContain("Unsupported booking provider: osm");
    expect(routeOptionsError).toBeInstanceOf(Error);
    expect((routeOptionsError as Error).message).toContain("Unsupported maps provider: osm");
    evidence.push({
      id: "lazy-unavailable-capabilities",
      selection: "osm; no flight provider",
      result: "gateway constructed; booking and maps calls rejected lazily",
      diagnostic: "unsupported stay/maps capability; missing flight credential",
    });
  });

  it("reports a selected Google Maps adapter without claiming a missing key is enabled", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const gateway = createToolGatewayWithRuntime(snapshotToolRuntime(), {
      fetch: vi.fn(),
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("Google Maps selected; MAPS_API_KEY is missing"),
    );
    const error = await gateway.maps
      .places({ near: "Tokyo", category: "temple" })
      .catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("MAPS_API_KEY");
    evidence.push({
      id: "missing-google-maps-credential-diagnostic",
      selection: "google selected; key absent",
      result: "gateway constructed; places rejected at call time",
      diagnostic: "Google Maps selected; MAPS_API_KEY is missing",
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
    const [googleRoutes, osmRoutes, osmPlaces] = await Promise.all([
      google.maps.route({
        from: "Tokyo",
        to: "Kyoto",
        departureTime: "2026-02-01T09:00:00+09:00",
      }),
      osm.maps.route({ from: "Tokyo", to: "Kyoto" }),
      osm.maps.places({ near: "Tokyo", category: "temple" }),
    ]);

    expect(googleRoutes[0]).toMatchObject({ mode: "transit", durationMin: 30 });
    expect(osmRoutes[0]?.note).toContain("OSRM driving-only");
    expect(osmPlaces[0]).toMatchObject({ category: "temple" });
    expect(googleFetch).toHaveBeenCalledTimes(1);
    expect(osmFetch).toHaveBeenCalledTimes(4);
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
      "google-driving-fallback",
      "google-intercity-rail-fallback",
      "google-route-options-partial-success",
      "booking-fallback-vs-flight-failure",
      "booking-primary-success",
      "booking-google-only-partial",
      "weather-horizons",
      "weather-lazy-missing-credential",
      "lazy-unavailable-capabilities",
      "missing-google-maps-credential-diagnostic",
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
