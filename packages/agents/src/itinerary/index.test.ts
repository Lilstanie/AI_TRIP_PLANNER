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
    const result = await createItineraryAgent({ generator: false }).run(brief, ctx);
    expect(AgentProposal.safeParse(result).success).toBe(true);
    expect(result.items.map((item) => item.day)).toEqual([1, 2]);
    expect(result.items.every((item) => item.startTime === "13:00")).toBe(true);
    expect(result.summary).not.toContain("STUB");
    expect(result.assumptions.join(" ")).toContain("deterministic fallback");
    expect(ctx.tools.maps.places).toHaveBeenCalledTimes(2);
  });

  it("uses an injected structured generator and checks travel feasibility", async () => {
    const generator: ItineraryGenerator = { generate: vi.fn(async () => feasibleDraft) };
    const result = await createItineraryAgent({ generator }).run(brief, context(200));
    expect(result.assumptions.join(" ")).toContain("DeepSeek/LangChain");
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
    const result = await createItineraryAgent({ generator }).run(brief, context());
    expect(result.assumptions.join(" ")).toContain("deterministic fallback");
    expect(result.items).toHaveLength(2);
    warning.mockRestore();
  });

  it("uses the safe fallback if a revision is still geographically infeasible", async () => {
    const generator: ItineraryGenerator = { generate: vi.fn(async () => feasibleDraft) };
    const agent = createItineraryAgent({ generator });
    const result = await agent.revise!(brief, context(200), {
      tripId: brief.tripId,
      targetAgent: "itinerary",
      reason: "geography conflict on day 1",
      constraints: ["make the route geographically feasible"],
    });
    expect(result.conflictsWith).toEqual([]);
    expect(result.assumptions.join(" ")).toContain("deterministic fallback");
  });

  it("rejects revisions addressed to another agent", async () => {
    const agent = createItineraryAgent({ generator: false });
    await expect(
      agent.revise!(brief, context(), {
        tripId: brief.tripId,
        targetAgent: "transport",
        reason: "time overlap",
        constraints: [],
      }),
    ).rejects.toThrow("target this trip and agent");
  });

  it("rejects impossible trip dates before calling tools", async () => {
    const ctx = context();
    await expect(
      createItineraryAgent({ generator: false }).run(
        { ...brief, dates: ["2026-02-30", "2026-03-02"] },
        ctx,
      ),
    ).rejects.toThrow("valid YYYY-MM-DD");
    expect(ctx.tools.maps.places).not.toHaveBeenCalled();
  });
});
