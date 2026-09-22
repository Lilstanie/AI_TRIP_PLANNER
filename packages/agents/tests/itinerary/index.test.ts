import { describe, expect, it, vi } from "vitest";
import { AgentProposal, type AgentContext, type TripBrief } from "@trip/shared";
import { createItineraryAgent, type ItineraryGenerator } from "../../src/itinerary";

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
        route: vi.fn(async () => [{ mode: "transit" as const, durationMin, price: 5 }]),
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
    // Two categories per city, not per brief: "near Tokyo & Kyoto" returns a
    // mix with nothing saying which place is in which city.
    expect(ctx.tools.maps.places).toHaveBeenCalledTimes(4);
    expect(ctx.tools.maps.places).toHaveBeenCalledWith({ near: "Tokyo", category: "sight" });
    expect(ctx.tools.maps.places).toHaveBeenCalledWith({ near: "Kyoto", category: "sight" });
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
    expect(result.source).toMatchObject({ kind: "fallback", label: "Local fallback" });
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
    ).rejects.toThrow("Enter a real date");
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

describe("city connections", () => {
  /** Four grounded places over two days: enough for a morning and afternoon stop. */
  function richContext(durationMin = 30): AgentContext {
    const base = context(durationMin);
    base.tools.maps.places = vi.fn(async ({ category }) =>
      category === "sight"
        ? [
            { name: "Sydney Opera House", category: "sight" },
            { name: "Sydney Tower Eye", category: "sight" },
          ]
        : [
            { name: "Bondi Beach", category: "neighborhood" },
            { name: "The Rocks", category: "neighborhood" },
          ],
    );
    base.tools.maps.routeOptions = vi.fn(async () => [
      { mode: "bus" as const, durationMin, price: 0, priceBasis: "unavailable" as const, note: "via bus 333" },
      { mode: "drive" as const, durationMin: 20, price: 0, priceBasis: "partial" as const },
    ]);
    return base;
  }

  it("plans two stops a day when there are places for them, and says how to get between", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: richContext(),
    });
    expect(result.items.map((item) => item.day)).toEqual([1, 1, 2, 2]);
    expect(result.items.map((item) => item.startTime)).toEqual([
      "09:30",
      "14:00",
      "09:30",
      "14:00",
    ]);
    // The connection is attached to the stop it arrives at, never the first of
    // the day — there is nothing to travel from.
    expect(result.items[0]!.arriveBy).toBeUndefined();
    expect(result.items[1]!.arriveBy).toMatchObject({
      mode: "bus",
      // The designation only: the mode is named beside it, so storing
      // "bus 333" renders as "Bus bus 333".
      line: "333",
      durationMin: 30,
      from: "Sydney Opera House",
    });
  });

  it("splits the day's allowance across its stops rather than spending it twice", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: richContext(),
    });
    const dayOne = result.items.filter((item) => item.day === 1);
    const single = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(),
    });
    const spent = dayOne.reduce((sum, item) => sum + (item.estCost ?? 0), 0);
    expect(spent).toBeLessThanOrEqual(single.items[0]!.estCost! + 0.01);
  });

  it("leaves the connection out when the route provider cannot answer", async () => {
    const ctx = richContext();
    ctx.tools.maps.route = vi.fn(async () => {
      throw new Error("route provider down");
    });
    const result = await createItineraryAgent({ generator: false }).invoke({ brief, context: ctx });
    expect(result.items.every((item) => item.arriveBy === undefined)).toBe(true);
    expect(result.conflictsWith.join(" ")).toContain("connection unverified");
  });
});

describe("multi-city days", () => {
  it("keeps a day's stops in the city that day is spent in", async () => {
    // A day that mixes cities is not a day: the five-day Sydney and Wollongong
    // plan put a Wollongong lookout and the Sydney CBD in one afternoon, two
    // hours apart, and the route check then reported it as a conflict.
    const ctx = context();
    ctx.tools.maps.places = vi.fn(async ({ near, category }) =>
      category === "sight"
        ? [
            { name: `${near} Museum`, category: "sight" },
            { name: `${near} Gallery`, category: "sight" },
          ]
        : [{ name: `${near} Old Town`, category: "neighborhood" }],
    );
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief: { ...brief, destination: "Tokyo & Kyoto", dates: ["2026-10-01", "2026-10-05"] },
      context: ctx,
    });
    for (const item of result.items) {
      // The journey moves to Kyoto partway through, and every stop belongs to
      // whichever city its own day is spent in.
      const city = item.day! <= 2 ? "Tokyo" : "Kyoto";
      expect(item.location, `day ${item.day}`).toContain(city);
    }
  });
});
