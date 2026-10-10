import { FakeToolCallingModel } from "langchain";
import { describe, expect, it, vi } from "vitest";
import type { MemoryStore, Specialist, ToolGateway, TripBrief } from "@trip/shared";
import {
  createSupervisorTools,
  dispatchWithSupervisor,
  reviseWithSupervisor,
} from "../src/supervisor";

const brief: TripBrief = {
  tripId: "supervisor-test",
  userId: "user-1",
  destination: "Sydney",
  dates: ["2026-10-01", "2026-10-04"],
  groupSize: 2,
  budgetTotal: 1800,
};

const tools: ToolGateway = {
  maps: { route: vi.fn(async () => []), places: vi.fn(async () => []) },
  booking: { searchStays: vi.fn(async () => []), searchFlights: vi.fn(async () => []) },
};
const mem: MemoryStore = {
  getShortTerm: vi.fn(async () => []),
  appendShortTerm: vi.fn(async () => {}),
  getLongTerm: vi.fn(async () => []),
  setLongTerm: vi.fn(async () => {}),
  promote: vi.fn(async () => {}),
};
const itinerary: Specialist = {
  name: "itinerary",
  label: "Day plan",
  invoke: vi.fn(async () => ({
    agent: "itinerary" as const,
    summary: "Three-day plan",
    items: [],
    assumptions: [],
    conflictsWith: [],
  })),
};
const context = { tripId: brief.tripId, round: 1, tools, mem };

describe("LangChain supervisor", () => {
  it("exposes specialists as schema-validated tools without accepting a replacement brief", async () => {
    const received: string[] = [];
    const [itineraryTool] = createSupervisorTools(
      { brief, specialists: [itinerary], context },
      (proposal) => received.push(proposal.agent),
    );

    expect(itineraryTool!.name).toBe("ask_itinerary_specialist");
    await itineraryTool!.invoke({ objective: "Build the daily schedule" });
    expect(itinerary.invoke).toHaveBeenCalledWith({ brief, context });
    expect(received).toEqual(["itinerary"]);
  });

  it("uses createAgent's tool loop and returns only the specialist selected by the model", async () => {
    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            name: "ask_itinerary_specialist",
            args: { objective: "Build the daily schedule" },
            id: "call-1",
          },
        ],
        [],
      ],
    });

    const proposals = await dispatchWithSupervisor({
      brief,
      specialists: [itinerary],
      context,
      model,
    });
    expect(proposals.map((proposal) => proposal.agent)).toEqual(["itinerary"]);
  });

  it("fails when the model skips a specialist the plan cannot do without", async () => {
    const dining: Specialist = {
      name: "dining",
      label: "Food & drink",
      invoke: async () => ({
        agent: "dining" as const,
        summary: "Meal budget envelope",
        items: [],
        assumptions: [],
        conflictsWith: [],
      }),
    };
    const model = new FakeToolCallingModel({
      toolCalls: [
        [{ name: "ask_dining_specialist", args: { objective: "Plan meals" }, id: "call-1" }],
        [],
      ],
    });

    await expect(
      dispatchWithSupervisor({ brief, specialists: [itinerary, dining], context, model }),
    ).rejects.toThrow(/skipped required specialist\(s\): itinerary/);
  });

  it("ignores a required specialist that was never offered as a tool", async () => {
    const dining: Specialist = {
      name: "dining",
      label: "Food & drink",
      invoke: async () => ({
        agent: "dining" as const,
        summary: "Meal budget envelope",
        items: [],
        assumptions: [],
        conflictsWith: [],
      }),
    };
    const model = new FakeToolCallingModel({
      toolCalls: [
        [{ name: "ask_dining_specialist", args: { objective: "Plan meals" }, id: "call-1" }],
        [],
      ],
    });

    const proposals = await dispatchWithSupervisor({
      brief,
      specialists: [dining],
      context,
      model,
    });
    expect(proposals.map((proposal) => proposal.agent)).toEqual(["dining"]);
  });

  it("routes an immutable revision request through its typed specialist tool", async () => {
    const request = {
      tripId: brief.tripId,
      targetAgent: "itinerary" as const,
      reason: "plan is over budget",
      constraints: ["cut itinerary cost by ~30%"],
    };
    const revisedAgent: Specialist = {
      ...itinerary,
      supportsRevision: true,
      invoke: vi.fn(async ({ revision }) => ({
        agent: "itinerary" as const,
        summary: revision!.reason,
        items: [],
        assumptions: revision!.constraints,
        conflictsWith: [],
      })),
    };
    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            name: "revise_itinerary_specialist",
            args: { objective: "Reduce itinerary cost" },
            id: "revision-1",
          },
        ],
        [],
      ],
    });

    const [proposal] = await reviseWithSupervisor({
      brief,
      specialists: [revisedAgent],
      context: { ...context, round: 2 },
      proposals: [await itinerary.invoke({ brief, context })],
      requests: [request],
      model,
    });
    expect(revisedAgent.invoke).toHaveBeenCalledWith({
      brief,
      context: expect.objectContaining({ round: 2 }),
      revision: request,
    });
    expect(proposal!.summary).toBe(request.reason);
  });
});
