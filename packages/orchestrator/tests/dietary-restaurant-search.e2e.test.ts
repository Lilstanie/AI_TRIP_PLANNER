import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiningAgent, runWithModelsDisabled } from "@trip/agents";
import { type TripBrief } from "@trip/shared";
import { itinerary, memoryStore, scriptedModel } from "./chat-test-fixtures";
const output = resolve(
  process.cwd(),
  "../../output/e2e/TP-43",
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
import { runTripChat } from "../src/chat";
describe("TP-43 dietary restaurant search", () => {
  it.each(["google", "osm"])(
    "uses chat diet and allergy in %s search and fallback without writing long-term memory",
    async (provider) => {
      vi.stubEnv("USE_MOCK_TOOLS", "false");
      vi.stubEnv("MAPS_PROVIDER", provider);
      vi.stubEnv("MAPS_API_KEY", "fixture-key");
      const searches: string[] = [];
      vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("places.googleapis.com")) {
          searches.push(JSON.parse(String(init?.body)).textQuery);
          return Response.json({
            places: [{ displayName: { text: "Market Kitchen" }, types: ["restaurant"] }],
          });
        }
        if (url.includes("nominatim")) {
          searches.push(new URL(url).searchParams.get("q")!);
          return Response.json([{ display_name: "Market Kitchen", type: "restaurant" }]);
        }
        throw new Error(`Unexpected provider call: ${url}`);
      });
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
            message: "Vegetarian, peanut allergy. Please plan the trip.",
          },
          {
            model,
            mem,
            tools: createToolGateway(),
            specialists: [itinerary, createDiningAgent({ generator: false })],
            clock: () => new Date("2027-06-01T00:00:00Z"),
          },
        ),
      );
      save(`dining-chat-${provider}`, { searches, result, turns });
      expect(searches.length).toBeGreaterThan(0);
      expect(searches.every((query) => /vegetarian/i.test(query) && /peanut/i.test(query))).toBe(
        true,
      );
      const dining = result.plan!.sections.find((section) => section.id === "dining")!.proposal!;
      expect(JSON.stringify(dining)).toMatch(/peanut/i);
      expect(JSON.stringify(dining)).toMatch(/vegetarian/i);
      expect(JSON.stringify(dining)).toMatch(/confirm/i);
      expect(JSON.stringify(dining)).not.toMatch(/allergy.safe|allergen.free|peanut.free/i);
      expect(mem.setLongTerm).not.toHaveBeenCalled();
      expect(turns.length).toBeGreaterThan(0);
    },
  );
});
