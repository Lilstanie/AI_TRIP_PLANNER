import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { transportAgent } from "@trip/agents";
import type { AgentContext, TripBrief } from "@trip/shared";
import { runOrchestrator } from "../src/workflow";

const brief: TripBrief = {
  tripId: "city-flight-test",
  userId: "traveller",
  origin: "Sydney",
  destination: "Tokyo & Kyoto",
  dates: ["2026-11-01", "2026-11-06"],
  groupSize: 1,
  budgetTotal: 9000,
  legModes: [{ from: "Tokyo", to: "Kyoto", mode: "flight" }],
};

describe("city flight planning workflow", () => {
  it("prices and schedules the selected city flight alongside the arrival flight", async () => {
    const searches: { from: string; to: string }[] = [];
    const context: AgentContext = {
      tripId: brief.tripId,
      round: 1,
      tools: {
        maps: { route: async () => [], places: async () => [] },
        booking: {
          searchFlights: async (query) => {
            searches.push({ from: query.from, to: query.to });
            return [{ carrier: "MockAir", price: query.from === "Sydney" ? 1000 : 250 }];
          },
          searchStays: async () => [],
        },
      },
      mem: {
        getLongTerm: async () => [],
        getShortTerm: async () => [],
        appendShortTerm: async () => {},
        setLongTerm: async () => {},
        promote: async () => {},
      },
    };
    const plan = await runOrchestrator(brief, {
      specialists: [transportAgent],
      tools: context.tools,
      mem: context.mem,
    });
    const proposal = plan.sections.find((section) => section.id === "transport")?.proposal;
    mkdirSync("output/tp27", { recursive: true });
    writeFileSync(
      "output/tp27/city-flight-workflow.json",
      JSON.stringify({ searches, plan }, null, 2),
    );
    expect(searches).toEqual(
      expect.arrayContaining([
        { from: "Sydney", to: "Tokyo" },
        { from: "Tokyo", to: "Kyoto" },
      ]),
    );
    expect(proposal?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          location: "Sydney → Tokyo",
          estCost: 1000,
          selectionId: "flight-0",
        }),
        expect.objectContaining({
          location: "Tokyo → Kyoto",
          estCost: 250,
          selectionId: "flight-1",
        }),
      ]),
    );
    expect(proposal?.flights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "Tokyo", to: "Kyoto", id: "flight-1" }),
      ]),
    );
  });
});
