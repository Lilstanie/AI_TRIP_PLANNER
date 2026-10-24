import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDestinationGuideAgent, runWithModelsDisabled } from "@trip/agents";
import { type TripBrief } from "@trip/shared";
import { runOrchestrator } from "../src/workflow";
import { itinerary, memoryStore } from "./chat-test-fixtures";
const output = resolve(
  process.cwd(),
  "../../output/e2e/weather-dining",
  process.env.RUN_ID ?? new Date().toISOString().replaceAll(/[:.]/g, "-"),
);
const brief: TripBrief = {
  tripId: "TP-weather-dining",
  userId: "traveller-d",
  destination: "Tokyo & Kyoto",
  dates: ["2027-06-15", "2027-06-18"],
  groupSize: 2,
  budgetTotal: 4000,
};
const save = (name: string, value: unknown) => {
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, `${name}.json`), JSON.stringify(value, null, 2));
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

import { createToolGateway } from "@trip/tools";
describe("TP-38 weather coverage", () => {
  it("retains every city/date including partial unavailability in the assembled plan", async () => {
    const requests: unknown[] = [];
    const plan = await runWithModelsDisabled(() =>
      runOrchestrator(brief, {
        mem: memoryStore().mem,
        specialists: [itinerary, createDestinationGuideAgent({ generator: false })],
        tools: {
          maps: {
            route: async () => [],
            places: async ({ near }) => [
              {
                name: near + " park",
                category: "sight",
                location: { latitude: near === "Kyoto" ? 35 : 36, longitude: 139 },
              },
            ],
          },
          booking: { searchStays: async () => [], searchFlights: async () => [] },
          weather: {
            forecast: async (query) => {
              requests.push(query);
              if (query.targetDate === "2027-06-16") throw new Error("fixture unavailable");
              return {
                targetDate: query.targetDate,
                horizon: query.targetDate === brief.dates[0] ? "forecast" : "climate",
                summary: "Rain showers, 8–14°C.",
                provider: "Fixture weather",
                observedAt: "2027-06-14T00:00:00Z",
              };
            },
          },
        },
      }),
    );
    save("TP-38-coverage", { requests, plan });
    expect(requests).toHaveLength(8);
    const guide = plan.sections.find((section) => section.id === "destination-guide")!.proposal!;
    const text = JSON.stringify(guide);
    for (const city of ["Tokyo", "Kyoto"])
      for (const day of ["Tue, 15 June", "Wed, 16 June", "Thu, 17 June", "Fri, 18 June"])
        expect(text).toContain(city + ", " + day);
    expect(text).toContain("weather unavailable");
    expect(text).toContain("historical climate, not a forecast");
  });
  it("reuses one Google forecast response across dates in the same city", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "fixture-key");
    const start = Date.now() + 2 * 86_400_000;
    const dates = Array.from({ length: 4 }, (_, index) =>
      new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    );
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url.replace(/key=[^&]+/, "key=fixture"));
      if (url.includes("places.googleapis.com"))
        return Response.json({
          places: [
            {
              displayName: { text: "Tokyo park" },
              location: { latitude: 35.68, longitude: 139.76 },
            },
          ],
        });
      if (url.includes("weather.googleapis.com"))
        return Response.json({
          forecastDays: dates.map((date) => {
            const [year, month, day] = date.split("-").map(Number);
            return {
              displayDate: { year, month, day },
              daytimeForecast: { weatherCondition: { description: { text: "Rain showers" } } },
              minTemperature: { degrees: 8 },
              maxTemperature: { degrees: 14 },
            };
          }),
        });
      throw new Error(`Unexpected provider call: ${url}`);
    });
    const plan = await runWithModelsDisabled(() =>
      runOrchestrator(
        { ...brief, destination: "Tokyo", dates: [dates[0]!, dates[3]!] },
        {
          mem: memoryStore().mem,
          tools: createToolGateway(),
          specialists: [itinerary, createDestinationGuideAgent({ generator: false })],
        },
      ),
    );
    save("weather-provider-cache", { calls, plan });
    expect(calls.filter((url) => url.includes("weather.googleapis.com"))).toHaveLength(1);
    const guide = plan.sections.find((section) => section.id === "destination-guide")!.proposal!;
    for (const date of dates) expect(JSON.stringify(guide)).toContain(date);
  });
});
