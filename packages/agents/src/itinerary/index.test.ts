import { describe, expect, it, vi } from "vitest";
import { AgentProposal, type AgentContext, type TripBrief } from "@trip/shared";
import { createItineraryAgent, type ItineraryGenerator } from "./index";

const brief: TripBrief = {
  tripId: "itinerary-test",
  userId: "traveller",
  destination: "Tokyo & Kyoto",
  dates: ["2026-10-01", "2026-10-03"],
  groupSize: 2,
  budgetTotal: 2000,
};

function context(durationMin = 30): AgentContext {
  return {
    tripId: brief.tripId,
    round: 1,
    tools: {
      maps: {
        places: vi.fn(async ({ category }) => [
          ...(category === "sight"
            ? [{ name: "Museum", category: "sight" }]
            : [
                { name: "Old Town", category: "neighborhood" },
                { name: "Garden", category: "neighborhood" },
              ]),
        ]),
        route: vi.fn(async () => [{ mode: "transit" as const, durationMin, priceUsd: 5 }]),
      },
      booking: { searchStays: vi.fn(async () => []), searchFlights: vi.fn(async () => []) },
    },
    mem: {
      getLongTerm: vi.fn(async () => [
        { key: "pace", value: "relaxed", source: "filter" as const },
      ]),
      getShortTerm: vi.fn(async () => []),
      appendShortTerm: vi.fn(async () => {}),
      setLongTerm: vi.fn(async () => {}),
      promote: vi.fn(async () => {}),
    },
  };
}

const feasibleDraft = {
  summary: "Two carefully paced days",
  activities: [
    {
      day: 1,
      startTime: "09:00",
      endTime: "11:00",
      location: "Museum",
      detail: "Visit the museum",
      estCost: 40,
    },
    {
      day: 1,
      startTime: "14:00",
      endTime: "16:00",
      location: "Old Town",
      detail: "Walk through the old town",
      estCost: 20,
    },
    {
      day: 2,
      startTime: "10:00",
      endTime: "12:00",
      location: "Garden",
      detail: "Visit the garden",
      estCost: 20,
    },
  ],
  assumptions: ["Candidate places require confirmation."],
};

describe("itinerary planner", () => {
  it("builds a complete deterministic schedule without a model", async () => {
    const ctx = context();
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: ctx,
    });
    expect(AgentProposal.safeParse(result).success).toBe(true);
    expect(result.items.map((item) => item.day)).toEqual([1, 2]);
    expect(result.items.every((item) => item.startTime === "13:00")).toBe(true);
    expect(result.summary).not.toContain("STUB");
    expect(result.assumptions.join(" ")).toContain("Opening hours and live availability");
    expect(ctx.tools.maps.places).toHaveBeenCalledTimes(2);
  });

  it("uses an injected structured generator and checks travel feasibility", async () => {
    const generator: ItineraryGenerator = { generate: vi.fn(async () => feasibleDraft) };
    const result = await createItineraryAgent({ generator }).invoke({
      brief,
      context: context(200),
    });
    expect(result.assumptions.join(" ")).not.toContain("LangChain");
    expect(result.conflictsWith[0]).toContain("geography conflict on day 1");
  });

  it("falls back when model output violates the budget guardrail", async () => {
    const generator: ItineraryGenerator = {
      generate: vi.fn(async () => ({
        ...feasibleDraft,
        activities: feasibleDraft.activities.map((activity) => ({
          ...activity,
          estCost: 1000,
        })),
      })),
    };
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await createItineraryAgent({ generator }).invoke({
      brief,
      context: context(),
    });
    expect(result.assumptions.join(" ")).toContain("Opening hours and live availability");
    expect(result.items).toHaveLength(2);
    warning.mockRestore();
  });

  it("uses the safe fallback if a revision is still geographically infeasible", async () => {
    const generator: ItineraryGenerator = { generate: vi.fn(async () => feasibleDraft) };
    const agent = createItineraryAgent({ generator });
    const result = await agent.invoke({
      brief,
      context: context(200),
      revision: {
        tripId: brief.tripId,
        targetAgent: "itinerary",
        reason: "geography conflict on day 1",
        constraints: ["make the route geographically feasible"],
      },
    });
    expect(result.conflictsWith).toEqual([]);
    expect(result.assumptions.join(" ")).toContain("Opening hours and live availability");
  });

  it("rejects revisions addressed to another agent", async () => {
    const agent = createItineraryAgent({ generator: false });
    await expect(
      agent.invoke({
        brief,
        context: context(),
        revision: {
          tripId: brief.tripId,
          targetAgent: "transport",
          reason: "time overlap",
          constraints: [],
        },
      }),
    ).rejects.toThrow("target this trip and agent");
  });

  it("rejects impossible trip dates before calling tools", async () => {
    const ctx = context();
    await expect(
      createItineraryAgent({ generator: false }).invoke({
        brief: { ...brief, dates: ["2026-02-30", "2026-03-02"] },
        context: ctx,
      }),
    ).rejects.toThrow("valid YYYY-MM-DD");
    expect(ctx.tools.maps.places).not.toHaveBeenCalled();
  });
});

describe("B itinerary reliability", () => {
  it("does not treat an empty route as a zero-minute journey", async () => {
    const ctx = context();
    vi.mocked(ctx.tools.maps.route).mockResolvedValue([]);
    const result = await createItineraryAgent({
      generator: { generate: async () => feasibleDraft },
    }).invoke({ brief, context: ctx });
    expect(result.conflictsWith.join(" ")).toContain("no route returned");
    expect(ctx.tools.maps.route).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2026-10-01" }),
    );
  });

  it("requires a fifteen-minute arrival buffer at the exact boundary", async () => {
    const generator = { generate: async () => feasibleDraft };
    const exact = await createItineraryAgent({ generator }).invoke({
      brief,
      context: context(165),
    });
    expect(exact.conflictsWith).toEqual([]);
    const late = await createItineraryAgent({ generator }).invoke({ brief, context: context(166) });
    expect(late.conflictsWith.join(" ")).toContain("15-minute buffer");
  });

  it("reports provider failure without dropping the complete proposal", async () => {
    const ctx = context();
    vi.mocked(ctx.tools.maps.route).mockRejectedValue(new Error("offline"));
    const result = await createItineraryAgent({
      generator: { generate: async () => feasibleDraft },
    }).invoke({ brief, context: ctx });
    expect(AgentProposal.safeParse(result).success).toBe(true);
    expect(result.conflictsWith.join(" ")).toContain("provider failed");
  });

  it("does not invent a central attraction when all evidence is unavailable", async () => {
    const ctx = context();
    vi.mocked(ctx.tools.maps.places).mockRejectedValue(new Error("offline"));
    const generate = vi.fn();
    const result = await createItineraryAgent({ generator: { generate } }).invoke({
      brief,
      context: ctx,
    });
    expect(result.items).toEqual([]);
    expect(result.conflictsWith.join(" ")).toContain("no grounded places");
    expect(generate).not.toHaveBeenCalled();
  });

  it("moves the deterministic fallback around A's blocked window", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(),
      revision: {
        tripId: brief.tripId,
        targetAgent: "itinerary",
        reason: "time overlap",
        constraints: [
          "on day 1 keep clear of 12:00-14:00, held by transport; reschedule without changing trip dates",
        ],
      },
    });
    expect(result.items[0]).toMatchObject({ startTime: "14:15", endTime: "17:15" });
    expect(result.conflictsWith).toEqual([]);
  });

  it("retains a conflict when no daytime slot remains", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(),
      revision: {
        tripId: brief.tripId,
        targetAgent: "itinerary",
        reason: "time overlap",
        constraints: ["on day 1 keep clear of 09:00-19:00, held by transport"],
      },
    });
    expect(result.conflictsWith.join(" ")).toContain("no daytime slot");
  });

  it("does not swallow cancellation during a model call", async () => {
    const controller = new AbortController();
    const ctx = { ...context(), signal: controller.signal };
    const generator = {
      generate: async () => {
        controller.abort();
        throw new Error("cancelled");
      },
    };
    await expect(
      createItineraryAgent({ generator }).invoke({ brief, context: ctx }),
    ).rejects.toThrow();
  });
});
