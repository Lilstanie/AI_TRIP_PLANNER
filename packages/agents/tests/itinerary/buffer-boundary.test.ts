import { describe, expect, it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import type { AgentContext, TripBrief } from "@trip/shared";

const seen = vi.hoisted(() => ({ prompt: "" }));
vi.mock("../../src/models", () => ({
  createRoutedChatModel: () => ({}),
  readStructuredResponse: (
    _name: string,
    schema: { parse(value: unknown): unknown },
    result: { structuredResponse: unknown },
  ) => schema.parse(result.structuredResponse),
}));
vi.mock("langchain", () => ({
  tool: (fn: () => Promise<unknown>) => fn,
  createAgent: ({ systemPrompt }: { systemPrompt: string }) => ({
    invoke: async () => {
      seen.prompt = systemPrompt;
      return {
        structuredResponse: {
          summary: "A day",
          assumptions: [],
          activities: [
            { day: 1, startTime: "09:00", endTime: "10:00", location: "Museum", detail: "Visit" },
            { day: 1, startTime: "10:45", endTime: "11:45", location: "Garden", detail: "Visit" },
          ],
        },
      };
    },
  }),
}));
import { createItineraryAgent } from "../../src/itinerary";

const brief: TripBrief = {
  tripId: "buffer-test",
  userId: "test",
  destination: "Sydney",
  dates: ["2026-11-01", "2026-11-01"],
  groupSize: 1,
  budgetTotal: 4000,
  noAccommodation: true,
};
const context = (durationMin: number): AgentContext => ({
  tripId: brief.tripId,
  round: 1,
  tools: {
    maps: {
      places: async () => [
        { name: "Museum", category: "sight" },
        { name: "Garden", category: "sight" },
      ],
      route: async () => [{ mode: "walk", durationMin, price: 0 }],
    },
    booking: { searchFlights: async () => [], searchStays: async () => [] },
  },
  mem: {
    getLongTerm: async () => [],
    getShortTerm: async () => [],
    appendShortTerm: async () => {},
    setLongTerm: async () => {},
    promote: async () => {},
  },
});

describe("itinerary route buffer at the model boundary", () => {
  it("uses the same route plus arrival buffer rule in the prompt and planning checks", async () => {
    const agent = createItineraryAgent();
    const short = await agent.invoke({ brief, context: context(30) });
    const long = await agent.invoke({ brief, context: context(31) });
    mkdirSync("output/tp25", { recursive: true });
    writeFileSync(
      "output/tp25/buffer-boundary.json",
      JSON.stringify({ prompt: seen.prompt, short, long }, null, 2),
    );
    expect(seen.prompt).not.toContain("150 minutes");
    expect(seen.prompt).toContain("15-minute");
    expect(seen.prompt).toContain("route");
    expect(short.conflictsWith.some((value) => value.includes("geography conflict"))).toBe(false);
    expect(long.conflictsWith.some((value) => value.includes("needs 46 minutes"))).toBe(true);
  });
});
