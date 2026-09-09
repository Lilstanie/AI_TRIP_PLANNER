import { describe, expect, it, vi } from "vitest";
import {
  AgentProposal,
  type AgentContext,
  type TripBrief,
  type UserPreference,
} from "@trip/shared";
import { createDiningAgent, type DiningGenerator } from "./index";

const brief: TripBrief = {
  tripId: "dining-test",
  userId: "traveller",
  destination: "Kyoto",
  dates: ["2026-10-01", "2026-10-03"],
  groupSize: 2,
  budgetTotal: 1000,
};

function context(preferences: UserPreference[] = [], withPlaces = true): AgentContext {
  return {
    tripId: brief.tripId,
    round: 1,
    tools: {
      maps: {
        places: vi.fn(async () =>
          withPlaces ? [{ name: "Market Kitchen", category: "restaurant", rating: 4.4 }] : [],
        ),
        route: vi.fn(async () => []),
      },
      booking: { searchStays: vi.fn(async () => []), searchFlights: vi.fn(async () => []) },
    },
    mem: {
      getLongTerm: vi.fn(async () => preferences),
      getShortTerm: vi.fn(async () => []),
      appendShortTerm: vi.fn(async () => {}),
      setLongTerm: vi.fn(async () => {}),
      promote: vi.fn(async () => {}),
    },
  };
}

const validDraft = {
  summary: "Dining candidates for the trip",
  dailyBudgetPerPersonUsd: 40,
  picks: [{ name: "Market Kitchen", detail: "Confirm the current menu directly." }],
  assumptions: ["Menus change."],
};

describe("dining planner", () => {
  it("creates one whole-trip budget envelope without double-counting venues", async () => {
    const result = await createDiningAgent({ generator: false }).run(brief, context());
    expect(AgentProposal.safeParse(result).success).toBe(true);
    expect(result.summary).not.toContain("STUB");
    expect(result.items[0]).toMatchObject({ kind: "meal-budget", estCost: 200 });
    expect(result.items[1]).toMatchObject({ kind: "meal", location: "Market Kitchen" });
    expect(result.items[1]!.estCost).toBeUndefined();
  });

  it("passes only dietary preferences to the generator and records them", async () => {
    const preferences: UserPreference[] = [
      { key: "dietary.allergy", value: "peanuts", source: "chat_confirmed" },
      { key: "transport.origin", value: "Sydney", source: "filter" },
    ];
    const generate = vi.fn(async () => validDraft);
    const generator: DiningGenerator = { generate };
    const result = await createDiningAgent({ generator }).run(brief, context(preferences));
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        dietaryPreferences: [preferences[0]],
        maxDailyPerPersonUsd: 50,
      }),
    );
    expect(result.assumptions.join(" ")).toContain("dietary.allergy=peanuts");
    expect(result.model).toBe("Injected generator");
  });

  it("falls back when model cost exceeds the budget guardrail", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const generator: DiningGenerator = {
      generate: vi.fn(async () => ({ ...validDraft, dailyBudgetPerPersonUsd: 500 })),
    };
    const result = await createDiningAgent({ generator }).run(brief, context());
    expect(result.items[0]!.estCost).toBe(200);
    expect(result.model).toBe("Deterministic fallback");
    warning.mockRestore();
  });

  it("cuts the meal envelope by 30 percent for a budget revision", async () => {
    const agent = createDiningAgent({ generator: false });
    const initial = await agent.run(brief, context());
    const revised = await agent.revise!(
      brief,
      { ...context(), round: 2 },
      {
        tripId: brief.tripId,
        targetAgent: "dining",
        reason: "plan is over budget",
        constraints: ["cut dining cost by ~30%"],
      },
    );
    expect(initial.items[0]!.estCost).toBe(200);
    expect(revised.items[0]!.estCost).toBe(140);
    expect(revised.assumptions.join(" ")).toContain("Revision requested");
  });

  it("falls back instead of accepting an ungrounded venue", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const generator: DiningGenerator = {
      generate: vi.fn(async () => ({
        ...validDraft,
        picks: [{ name: "Invented Restaurant", detail: "Not in MapsPort." }],
      })),
    };
    const result = await createDiningAgent({ generator }).run(brief, context());
    expect(result.items.map((item) => item.location).filter(Boolean)).toEqual(["Market Kitchen"]);
    expect(result.model).toBe("Deterministic fallback");
    warning.mockRestore();
  });

  it("returns only a budget envelope when no venue candidates exist", async () => {
    const result = await createDiningAgent({ generator: false }).run(brief, context([], false));
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.kind).toBe("meal-budget");
  });

  it("does not exceed even a very small total trip budget", async () => {
    const tinyBudget = { ...brief, budgetTotal: 0.01 };
    const result = await createDiningAgent({ generator: false }).run(tinyBudget, context());
    expect(result.items[0]!.estCost).toBeLessThanOrEqual(tinyBudget.budgetTotal);
  });

  it("rejects invalid dates and revisions before external calls", async () => {
    const ctx = context();
    const agent = createDiningAgent({ generator: false });
    await expect(agent.run({ ...brief, dates: ["2026-10-03", "2026-10-01"] }, ctx)).rejects.toThrow(
      "ordered dates",
    );
    expect(ctx.tools.maps.places).not.toHaveBeenCalled();

    await expect(
      agent.revise!(brief, context(), {
        tripId: "wrong-trip",
        targetAgent: "dining",
        reason: "budget",
        constraints: [],
      }),
    ).rejects.toThrow("target this trip");
  });
});
