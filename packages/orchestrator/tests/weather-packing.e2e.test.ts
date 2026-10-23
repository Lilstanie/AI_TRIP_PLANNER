import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDestinationGuideAgent,
  runWithModelsDisabled,
  type DestinationGuideGenerator,
} from "@trip/agents";
import { type AgentProgressEvent, type TripBrief, TripPlan } from "@trip/shared";
import { runOrchestrator } from "../src/workflow";
import { itinerary, memoryStore, scriptedModel } from "./chat-test-fixtures";
const output = resolve(
  process.cwd(),
  "../../output/e2e/TP-37",
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
const guideDraft = {
  summary: "Grounded destination advice",
  attractions: [],
  customs: ["Follow venue rules."],
  safety: ["Check official guidance."],
  entryHealth: ["Check official entry requirements."],
  weather: "Monthly context only.",
  packing: ["Walking shoes"],
  assumptions: [],
};
const save = (name: string, value: unknown) => {
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, `${name}.json`), JSON.stringify(value, null, 2));
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("TP-37 weather-grounded packing", () => {
  it("carries city/day weather into the generator, assembled plan and progress stream", async () => {
    const requests: unknown[] = [];
    const events: AgentProgressEvent[] = [];
    const generated: unknown[] = [];
    const mem = memoryStore().mem;
    const generator: DestinationGuideGenerator = {
      generate: async (input) => {
        generated.push(input);
        return { ...guideDraft, packing: ["Rain jacket from weather evidence"] };
      },
    };
    const plan = await runWithModelsDisabled(() =>
      runOrchestrator(brief, {
        mem,
        specialists: [itinerary, createDestinationGuideAgent({ generator })],
        supervisorModel: scriptedModel([
          {
            name: "ask_itinerary_specialist",
            args: { objective: "Plan the trip days." },
            id: "itinerary",
          },
          {
            name: "ask_destination_guide_specialist",
            args: { objective: "Prepare weather and packing advice." },
            id: "guide",
          },
        ]),
        onProgress: (event) => events.push(event),
        tools: {
          maps: {
            route: async () => [],
            places: async ({ near, category }) => [
              {
                name: `${near} ${category}`,
                category: category ?? "sight",
                location: { latitude: near === "Kyoto" ? 35 : 36, longitude: 139 },
              },
            ],
          },
          booking: { searchStays: async () => [], searchFlights: async () => [] },
          weather: {
            forecast: async (query) => {
              requests.push(query);
              return {
                targetDate: query.targetDate,
                horizon: query.targetDate === brief.dates[0] ? "forecast" : "climate",
                summary: "Rain showers, 8–14°C; historical context when climate, not a forecast.",
                provider: "Open-Meteo fixture evidence",
                observedAt: "2027-06-14T00:00:00Z",
              };
            },
          },
        },
      }),
    );
    save("weather-journey", { requests, generated, plan, events });
    expect(TripPlan.safeParse(plan).success).toBe(true);
    const input = generated[0] as { weatherEvidence?: Array<{ city: string; targetDate: string }> };
    expect(input.weatherEvidence?.length).toBeGreaterThanOrEqual(4);
    expect(new Set(input.weatherEvidence?.map((entry) => entry.city))).toEqual(
      new Set(["Tokyo", "Kyoto"]),
    );
    for (const date of ["2027-06-15", "2027-06-16", "2027-06-17", "2027-06-18"])
      expect(input.weatherEvidence?.some((entry) => entry.targetDate === date)).toBe(true);
    const guide = plan.sections.find((section) => section.id === "destination-guide")!.proposal!;
    expect(JSON.stringify(guide)).toContain("2027-06-18");
    expect(JSON.stringify(guide)).toContain("Kyoto");
    expect(JSON.stringify(guide)).toContain("Rain jacket from weather evidence");
    expect(events.some((event) => JSON.stringify(event).includes("weather.forecast"))).toBe(true);
  });

  it.each([false, true])(
    "keeps weather-grounded packing when generator fails=%s and one day is unavailable",
    async (failedGenerator) => {
      const events: AgentProgressEvent[] = [];
      const plan = await runWithModelsDisabled(() =>
        runOrchestrator(
          { ...brief, destination: "Tokyo" },
          {
            mem: memoryStore().mem,
            specialists: [
              itinerary,
              createDestinationGuideAgent({
                generator: failedGenerator
                  ? {
                      generate: async () => {
                        throw new Error("fixture model failure");
                      },
                    }
                  : false,
              }),
            ],
            onProgress: (event) => events.push(event),
            tools: {
              maps: {
                route: async () => [],
                places: async () => [
                  {
                    name: "Tokyo park",
                    category: "sight",
                    location: { latitude: 36, longitude: 139 },
                  },
                ],
              },
              booking: { searchStays: async () => [], searchFlights: async () => [] },
              weather: {
                forecast: async ({ targetDate }) => {
                  if (targetDate === "2027-06-16") throw new Error("fixture weather failure");
                  return {
                    targetDate,
                    horizon: "forecast",
                    summary: "Rain showers, 2–8°C.",
                    observedAt: "2027-06-14T00:00:00Z",
                    provider: "Google Weather API",
                  };
                },
              },
            },
          },
        ),
      );
      save(`weather-fallback-${failedGenerator}`, { plan, events });
      const guide = plan.sections.find((section) => section.id === "destination-guide")!.proposal!;
      expect(
        guide.items.find((item) => item.kind === "weather-packing")?.packing?.join(" "),
      ).toMatch(/rain|waterproof/i);
      expect(JSON.stringify(guide)).toMatch(/2027-06-16[^]*unavailable|unavailable[^]*2027-06-16/i);
      expect(JSON.stringify(guide)).toContain("2027-06-18");
      expect(guide.source?.kind).toBe("fallback");
    },
  );
});
