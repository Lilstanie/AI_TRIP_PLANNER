import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runWithModelsDisabled } from "@trip/agents";
import { AgentLabCompletedRunArtifact } from "@trip/shared";
import { afterEach, expect, it, vi } from "vitest";
import { runAgentLab } from "../src/agent-lab";
import { findAgentLabScenario } from "../src/agent-lab/scenarios";

const output = resolve(process.cwd(), "../../output/e2e/provider-boundary-live");
const place = (name: string) => ({
  displayName: { text: name },
  rating: 4.6,
  priceLevel: "PRICE_LEVEL_MODERATE",
  formattedAddress: "Tokyo, Japan",
  location: { latitude: 35.68, longitude: 139.69 },
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("completes a live Planning Run with provider facts under a mock-default deployment", async () => {
  vi.setSystemTime(new Date("2026-11-01T00:00:00.000Z"));
  vi.stubEnv("USE_MOCK_TOOLS", "true");
  vi.stubEnv("MAPS_PROVIDER", "google");
  vi.stubEnv("MAPS_API_KEY", "stub-maps-key");
  vi.stubEnv("WEATHER_API_KEY", "stub-weather-key");
  vi.stubEnv("SERPAPI_KEY", "");
  vi.stubEnv("DEEPSEEK_API_KEY", "");
  vi.stubEnv("MINIMAX_API_KEY", "");

  const requests: string[] = [];
  const network = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("places.googleapis.com")) {
      const query = JSON.parse(String(init?.body)).textQuery as string;
      const city = query.includes("Kyoto") ? "Kyoto" : "Tokyo";
      const names = query.startsWith("hotels in")
        ? [`Live Test ${city} Hotel One`, `Live Test ${city} Hotel Two`]
        : query.startsWith("restaurant in")
          ? ["Live Test Vegetarian Table", "Live Test Noodle House"]
          : city === "Kyoto"
            ? ["Live Test Kyoto Temple", "Live Test Kyoto Garden"]
            : ["Live Test Sensoji", "Live Test Ueno Garden"];
      return Response.json({ places: names.map(place) });
    }
    if (url.includes("maps.googleapis.com/maps/api/timezone/json")) {
      return Response.json({ status: "OK", timeZoneId: "Asia/Tokyo" });
    }
    if (url.includes("routes.googleapis.com")) {
      return Response.json({ routes: [{ duration: "1800s", distanceMeters: 12_000 }] });
    }
    if (url.includes("weather.googleapis.com")) {
      return Response.json({
        forecastDays: [
          {
            displayDate: { year: 2026, month: 11, day: 10 },
            daytimeForecast: { weatherCondition: { description: { text: "Clear live test sky" } } },
            maxTemperature: { degrees: 19 },
            minTemperature: { degrees: 11 },
          },
        ],
      });
    }
    throw new Error(`Unexpected provider request: ${url}`);
  });
  vi.stubGlobal("fetch", network);

  const scenario = findAgentLabScenario("tokyo-kyoto-multi-city");
  const artifact = await runWithModelsDisabled(() =>
    runAgentLab(
      { scenarioId: scenario.id, strategyId: "multi-agent-no-revision", dataMode: "live" },
      { paceMs: 0, runId: "provider-boundary-live" },
    ),
  );
  const parsed = AgentLabCompletedRunArtifact.parse(artifact);
  const planText = JSON.stringify(parsed.plan);
  const artifactText = JSON.stringify(parsed);
  const hotel = parsed.plan.sections.find((section) => section.id === "accommodation");
  const destination = parsed.plan.sections.find((section) => section.id === "destination-guide");
  const checks = {
    completed:
      parsed.status === "completed" &&
      parsed.dataMode === "live" &&
      parsed.events.length > 0 &&
      parsed.events.every((entry) => entry.dataMode === "live"),
    briefAndPlan:
      parsed.plan.tripId === scenario.brief.tripId &&
      parsed.plan.brief.destination === scenario.brief.destination &&
      parsed.plan.brief.origin === scenario.brief.origin &&
      parsed.plan.sections.length === 5,
    providerRequests:
      requests.some((url) => url.includes("places.googleapis.com")) &&
      requests.some((url) => url.includes("routes.googleapis.com")) &&
      requests.some((url) => url.includes("weather.googleapis.com")),
    providerFacts:
      planText.includes("Live Test Tokyo Hotel") &&
      planText.includes("Live Test Kyoto Hotel") &&
      planText.includes("Live Test Sensoji") &&
      planText.includes("Clear live test sky") &&
      hotel?.proposal?.source?.label === "Google Places estimate" &&
      destination?.proposal?.assumptions.some((value) => value.includes("Google Weather API")) ===
        true,
    noFixtureFacts:
      !/Mock |mock booking|mock train|mock drive|mock rates|may still be mock|Agent Lab fixture|Fixed scenario v1/i.test(
        artifactText,
      ) && parsed.plan.sections.every((section) => section.proposal?.source?.kind !== "mock"),
  };

  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, "artifact.json"), `${JSON.stringify(parsed, null, 2)}\n`);
  const saved = AgentLabCompletedRunArtifact.parse(
    JSON.parse(readFileSync(resolve(output, "artifact.json"), "utf8")),
  );
  const summary = {
    passed: Object.values(checks).every(Boolean) && JSON.stringify(saved) === artifactText,
    checks,
    requests,
  };
  writeFileSync(resolve(output, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

  expect(summary).toMatchObject({ passed: true });
  expect(saved).toEqual(parsed);
});
