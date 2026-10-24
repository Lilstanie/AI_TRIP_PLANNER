import { describe, expect, it, vi } from "vitest";
import {
  AgentProposal,
  type AgentContext,
  type Place,
  type TripBrief,
  type UserPreference,
} from "@trip/shared";
import { createDiningAgent, type DiningGenerator } from "../../src/dining";

const brief: TripBrief = {
  tripId: "dining-test",
  userId: "traveller",
  destination: "Kyoto",
  dates: ["2026-10-01", "2026-10-02"],
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
  picks: [{ name: "Market Kitchen", detail: "Confirm the current menu directly." }],
  assumptions: ["Menus change."],
};

describe("dining planner", () => {
  it("creates one whole-trip budget envelope without double-counting venues", async () => {
    const result = await createDiningAgent({ generator: false }).invoke({
      brief,
      context: context(),
    });
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
    const result = await createDiningAgent({ generator }).invoke({
      brief,
      context: context(preferences),
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        dietaryPreferences: [preferences[0]],
        dailyBudgetPerPerson: 50,
      }),
    );
    expect(result.assumptions.join(" ")).toContain("dietary.allergy=peanuts");
    expect(result.assumptions.join(" ")).not.toContain("LangChain");
  });

  it("recognizes common dietary terms even when stored under a generic preference key", async () => {
    const preferences: UserPreference[] = [
      { key: "preference", value: "plant-based and shellfish allergy", source: "chat_confirmed" },
      { key: "transport.origin", value: "Sydney", source: "filter" },
    ];
    const generate = vi.fn(async () => validDraft);

    await createDiningAgent({ generator: { generate } }).invoke({
      brief,
      context: context(preferences),
    });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ dietaryPreferences: [preferences[0]] }),
    );
  });

  it("does not pass unrelated preferences to the dining generator", async () => {
    const preferences: UserPreference[] = [
      { key: "transport.origin", value: "Sydney", source: "filter" },
      { key: "accommodation.roomAllocation", value: "individual", source: "filter" },
    ];
    const generate = vi.fn(async () => validDraft);

    await createDiningAgent({ generator: { generate } }).invoke({
      brief,
      context: context(preferences),
    });

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ dietaryPreferences: [] }));
  });

  it("deduplicates and canonicalizes venue names before returning them", async () => {
    const ctx = context();
    ctx.tools.maps.places = vi.fn(async () => [
      { name: "Market Kitchen", category: "restaurant" },
      { name: " market  kitchen ", category: "restaurant" },
    ]);
    const generator: DiningGenerator = {
      generate: vi.fn(async ({ places }: { places: Place[] }) => ({
        ...validDraft,
        picks: places.map((place) => ({ name: place.name, detail: "Confirm the current menu." })),
      })),
    };

    const result = await createDiningAgent({ generator }).invoke({
      brief,
      context: ctx,
    });

    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ places: [{ name: "Market Kitchen", category: "restaurant" }] }),
    );
    expect(result.items.filter((item) => item.kind === "meal")).toHaveLength(1);
    expect(result.items.find((item) => item.kind === "meal")?.location).toBe("Market Kitchen");
  });

  it("deduplicates repeated venue names after canonicalization", async () => {
    const generator: DiningGenerator = {
      generate: vi.fn(async () => ({
        ...validDraft,
        picks: [
          { name: "Market Kitchen", detail: "Confirm the current menu." },
          { name: "  market kitchen  ", detail: "Duplicate entry." },
        ],
      })),
    };

    const result = await createDiningAgent({ generator }).invoke({
      brief,
      context: context(),
    });

    expect(result.items.filter((item) => item.kind === "meal")).toHaveLength(1);
    expect(result.items.find((item) => item.kind === "meal")?.location).toBe("Market Kitchen");
  });

  it("gives the same meal budget whether the model answers, fails or is absent", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sydney: TripBrief = {
      ...brief,
      destination: "Sydney",
      dates: ["2026-11-14", "2026-11-17"],
      budgetTotal: 4000,
    };
    const runs = await Promise.all(
      [
        { generate: vi.fn(async () => ({ ...validDraft, dailyBudgetPerPerson: 115 })) },
        {
          generate: vi.fn(async () => {
            throw new Error("model timeout");
          }),
        },
        false as const,
      ].map((generator) =>
        createDiningAgent({ generator }).invoke({ brief: sydney, context: context() }),
      ),
    );
    for (const run of runs) {
      expect(run.items[0]).toMatchObject({ kind: "meal-budget", estCost: 640 });
      expect(run.items[0]!.detail).toContain("AUD 80.00 per person/day");
    }
    expect(runs.map((run) => run.source?.kind)).toEqual(["mock", "fallback", "fallback"]);
    warning.mockRestore();
  });

  it("keeps the meal rate within what a small budget leaves for meals", async () => {
    const result = await createDiningAgent({
      generator: { generate: vi.fn(async () => validDraft) },
    }).invoke({ brief, context: context() });
    expect(result.items[0]!.estCost).toBe(200);
  });

  it("cuts the meal envelope by 30 percent for a budget revision", async () => {
    const agent = createDiningAgent({ generator: false });
    const initial = await agent.invoke({ brief, context: context() });
    const revised = await agent.invoke({
      brief,
      context: { ...context(), round: 2 },
      revision: {
        tripId: brief.tripId,
        targetAgent: "dining",
        kind: "budget" as const,
        reason: "plan is over budget",
        constraints: ["cut dining cost by ~30%"],
      },
    });
    expect(initial.items[0]!.estCost).toBe(200);
    expect(revised.items[0]!.estCost).toBe(140);
    expect(revised.assumptions.join(" ")).toContain("Revision requested");
  });

  it("passes the reduced budget ceiling to a revised generator", async () => {
    const generate = vi.fn(async () => validDraft);
    const agent = createDiningAgent({ generator: { generate } });

    await agent.invoke({
      brief,
      context: context(),
      revision: {
        tripId: brief.tripId,
        targetAgent: "dining",
        kind: "budget" as const,
        reason: "plan is over budget",
        constraints: ["cut dining cost by ~30%"],
      },
    });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyBudgetPerPerson: 35,
        revision: expect.objectContaining({ targetAgent: "dining" }),
      }),
    );
  });

  it("falls back instead of accepting an ungrounded venue", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const generator: DiningGenerator = {
      generate: vi.fn(async () => ({
        ...validDraft,
        picks: [{ name: "Invented Restaurant", detail: "Not in MapsPort." }],
      })),
    };
    const result = await createDiningAgent({ generator }).invoke({
      brief,
      context: context(),
    });
    expect(result.items.map((item) => item.location).filter(Boolean)).toEqual(["Market Kitchen"]);
    expect(result.source).toMatchObject({ kind: "fallback", label: "Local fallback" });
    warning.mockRestore();
  });

  it("returns only a budget envelope when no venue candidates exist", async () => {
    const result = await createDiningAgent({ generator: false }).invoke({
      brief,
      context: context([], false),
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.kind).toBe("meal-budget");
  });

  it("does not exceed even a very small total trip budget", async () => {
    const tinyBudget = { ...brief, budgetTotal: 0.01 };
    const result = await createDiningAgent({ generator: false }).invoke({
      brief: tinyBudget,
      context: context(),
    });
    expect(result.items[0]!.estCost).toBeLessThanOrEqual(tinyBudget.budgetTotal);
  });

  it("rejects invalid dates and revisions before external calls", async () => {
    const ctx = context();
    const agent = createDiningAgent({ generator: false });
    await expect(
      agent.invoke({
        brief: { ...brief, dates: ["2026-10-03", "2026-10-01"] },
        context: ctx,
      }),
    ).rejects.toThrow("End date must follow start date");
    expect(ctx.tools.maps.places).not.toHaveBeenCalled();

    await expect(
      agent.invoke({
        brief,
        context: context(),
        revision: {
          tripId: "wrong-trip",
          targetAgent: "dining",
          kind: "budget" as const,
          reason: "budget",
          constraints: [],
        },
      }),
    ).rejects.toThrow("target this trip");
  });
});
