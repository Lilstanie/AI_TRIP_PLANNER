import { describe, expect, it, vi } from "vitest";
import type { Specialist, TripBrief, ToolGateway, MemoryStore } from "@trip/shared";
import { runOrchestrator } from "../../../orchestrator/src/workflow";
import { createItineraryAgent } from "../itinerary";

const brief: TripBrief = {
  tripId: "b-integration",
  userId: "test",
  destination: "Tokyo",
  dates: ["2026-10-01", "2026-10-03"],
  groupSize: 2,
  budgetTotal: 4000,
};
const mem: MemoryStore = {
  getLongTerm: async () => [],
  getShortTerm: async () => [],
  appendShortTerm: async () => {},
  setLongTerm: async () => {},
  promote: async () => {},
};
const tools: ToolGateway = {
  maps: {
    places: async () => [{ name: "Grounded museum", category: "sight" }],
    route: async () => [],
  },
  booking: { searchFlights: async () => [], searchStays: async () => [] },
};

describe("B proposals in the actual LangGraph workflow", () => {
  it("resolves an A-generated blocked-window request in round two", async () => {
    const blockingTransport: Specialist = {
      name: "transport",
      label: "Test transport",
      invoke: async () => ({
        agent: "transport",
        summary: "Reserved transit window",
        items: [
          {
            kind: "transport",
            detail: "Fixture",
            day: 1,
            startTime: "12:00",
            endTime: "14:00",
            estCost: 10,
          },
        ],
        assumptions: [],
        conflictsWith: [],
      }),
    };
    const plan = await runOrchestrator(brief, {
      specialists: [createItineraryAgent({ generator: false }), blockingTransport],
      tools,
      mem,
    });
    expect(plan.round).toBe(2);
    expect(plan.sections.find((s) => s.id === "itinerary")!.proposal!.items[0]).toMatchObject({
      startTime: "14:15",
      endTime: "17:15",
    });
    expect(plan.hitl.some((h) => h.type === "escalation")).toBe(false);
  });
  it("propagates missing evidence to K=3 escalation instead of a false successful itinerary", async () => {
    const plan = await runOrchestrator(brief, {
      specialists: [createItineraryAgent({ generator: false })],
      tools: { ...tools, maps: { ...tools.maps, places: vi.fn(async () => []) } },
      mem,
    });
    expect(plan.round).toBe(3);
    expect(plan.sections[0]!.status).toBe("needs_you");
    expect(plan.hitl.some((h) => h.type === "escalation")).toBe(true);
  });
});
