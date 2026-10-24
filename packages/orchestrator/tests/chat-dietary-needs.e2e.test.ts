import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiningAgent, runWithModelsDisabled } from "@trip/agents";
import { type TripBrief } from "@trip/shared";
import { runOrchestrator } from "../src/workflow";
import { itinerary, memoryStore, scriptedModel } from "./chat-test-fixtures";
const output = resolve(
  process.cwd(),
  "../../output/e2e/TP-41",
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

import { runTripChat } from "../src/chat";
describe("TP-41 dietary needs from chat", () => {
  it("keeps a no-model chat's dietary needs in the final dining fallback", async () => {
    const result = await runWithModelsDisabled(() =>
      runTripChat(
        {
          tripId: brief.tripId,
          brief: { ...brief, destination: "Tokyo", learnedPreferences: ["Quiet places"] },
          message: "Vegetarian, peanut allergy. Please plan the trip.",
        },
        {
          mem: memoryStore().mem,
          tools: {
            maps: {
              route: async () => [],
              places: async () => [{ name: "Market Kitchen", category: "restaurant" }],
            },
            booking: { searchStays: async () => [], searchFlights: async () => [] },
          },
          specialists: [itinerary, createDiningAgent({ generator: false })],
          clock: () => new Date("2027-06-01T00:00:00Z"),
        },
      ),
    );
    save("dining-no-model-chat", result);
    const dining = result.plan!.sections.find((section) => section.id === "dining")!.proposal!;
    expect(JSON.stringify(dining)).toMatch(/peanut/i);
    expect(JSON.stringify(dining)).toMatch(/vegetarian/i);
    expect(result.plan!.brief.learnedPreferences).toContain("Quiet places");
  });

  it("rejects a model draft that claims an allergy-safe venue", async () => {
    const result = await runWithModelsDisabled(() =>
      runOrchestrator(
        { ...brief, destination: "Tokyo", preferences: ["花生過敏", "素食"] },
        {
          mem: memoryStore().mem,
          tools: {
            maps: {
              route: async () => [],
              places: async () => [{ name: "Market Kitchen", category: "restaurant" }],
            },
            booking: { searchStays: async () => [], searchFlights: async () => [] },
          },
          specialists: [
            itinerary,
            createDiningAgent({
              generator: {
                generate: async () => ({
                  summary: "Allergy-safe restaurants",
                  picks: [
                    {
                      name: "Market Kitchen",
                      detail: "Guaranteed peanut-free and safe for allergies.",
                    },
                  ],
                  assumptions: [],
                }),
              },
            }),
          ],
        },
      ),
    );
    save("dining-unsafe-model", result);
    const dining = result.sections.find((section) => section.id === "dining")!.proposal!;
    expect(dining.source?.kind).toBe("fallback");
    expect(JSON.stringify(dining)).not.toMatch(/allergy.safe|peanut.free/i);
    expect(JSON.stringify(dining)).toContain("花生過敏");
  });

  it.each([false, true])(
    "passes model-extracted dietary needs to generator/fallback (model=%s)",
    async (withGenerator) => {
      const inputs: unknown[] = [];
      const { mem, turns } = memoryStore();
      const model = scriptedModel(
        [
          {
            name: "update_trip_brief",
            args: { learnedPreferences: ["Vegetarian", "Peanut allergy"] },
            id: "diet",
          },
        ],
        [{ name: "replan_trip", args: {}, id: "plan" }],
      );
      const result = await runWithModelsDisabled(() =>
        runTripChat(
          {
            tripId: brief.tripId,
            brief: { ...brief, destination: "Tokyo" },
            message: "Vegetarian, peanut allergy. Plan the trip.",
          },
          {
            model,
            mem,
            clock: () => new Date("2027-06-01T00:00:00Z"),
            tools: {
              maps: {
                route: async () => [],
                places: async () => [{ name: "Market Kitchen", category: "restaurant" }],
              },
              booking: { searchStays: async () => [], searchFlights: async () => [] },
            },
            specialists: [
              itinerary,
              createDiningAgent({
                generator: withGenerator
                  ? {
                      generate: async (input) => {
                        inputs.push(input);
                        return {
                          summary: "Grounded dining",
                          picks: [
                            { name: "Market Kitchen", detail: "Confirm ingredients directly." },
                          ],
                          assumptions: [],
                        };
                      },
                    }
                  : false,
              }),
            ],
          },
        ),
      );
      save("TP-41-dietary-" + withGenerator, { result, inputs, turns });
      const dining = result.plan!.sections.find((section) => section.id === "dining")!.proposal!;
      expect(JSON.stringify(dining)).toMatch(/vegetarian/i);
      expect(JSON.stringify(dining)).toMatch(/peanut/i);
      if (withGenerator) expect(JSON.stringify(inputs)).toMatch(/peanut/i);
      expect(mem.setLongTerm).not.toHaveBeenCalled();
    },
  );
});
