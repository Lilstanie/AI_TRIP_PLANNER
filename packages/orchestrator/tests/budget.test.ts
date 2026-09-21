import { describe, expect, it } from "vitest";
import type { AgentProposal, TripSection } from "@trip/shared";
import { assessBudget, costOf, rollUpCost, ESCALATION_OVERRUN_PCT } from "../src/budget";
import { detectConflicts, runOrchestrator, DEMO_BRIEF } from "../src";

function proposal(agent: AgentProposal["agent"], cost: number): AgentProposal {
  return {
    agent,
    summary: agent,
    items: [{ kind: "cost", detail: "Selected option", estCost: cost }],
    assumptions: [],
    conflictsWith: [],
  };
}

describe("budget calculations", () => {
  it("keeps cent precision and does not add a cost for informational notes", () => {
    const result = costOf({
      ...proposal("accommodation", 0.1),
      items: [
        { kind: "hotel", detail: "Night 1", estCost: 0.1 },
        { kind: "hotel", detail: "Night 2", estCost: 0.2 },
        { kind: "note", detail: "Other hotels considered" },
      ],
    });
    expect(result).toBe(0.3);
    expect(assessBudget([result], 0.3)).toEqual({ estTotal: 0.3, overrunPct: 0 });
  });

  it("rolls up all selected sections, including cents", () => {
    const sections: TripSection[] = [
      { id: "accommodation", label: "Stay", summary: "", status: "draft", estCost: 800.25 },
      { id: "transport", label: "Travel", summary: "", status: "draft", estCost: 200.5 },
    ];
    expect(rollUpCost(sections, 1000)).toEqual({ estTotal: 1000.75, overrunPct: 0.075 });
    expect(rollUpCost([], 1000)).toEqual({ estTotal: 0, overrunPct: -100 });
  });

  it("does not round an overrun down before checking the 10% escalation threshold", () => {
    expect(assessBudget([1100], 1000).overrunPct).toBe(ESCALATION_OVERRUN_PCT);
    expect(assessBudget([1100.01], 1000).overrunPct).toBeGreaterThan(ESCALATION_OVERRUN_PCT);
  });

  it.each([0, -1, NaN, Infinity, 0.001])("rejects an invalid budget: %s", (budget) => {
    expect(() => assessBudget([100], budget)).toThrow();
  });

  it.each([-1, NaN, Infinity])(
    "rejects an invalid cost passed directly to assessBudget: %s",
    (cost) => {
      expect(() => assessBudget([cost], 1000)).toThrow();
    },
  );

  it.each([-1, NaN, Infinity, undefined])(
    "costOf treats a bad estCost from one agent as 0 instead of throwing: %s",
    (badCost) => {
      const bad = proposal("dining", 0);
      bad.items = [{ kind: "meal", detail: "junk", estCost: badCost }];
      expect(costOf(bad)).toBe(0);
      // detectConflicts must not crash the whole run over one agent's bad number.
      expect(() =>
        detectConflicts([bad, proposal("accommodation", 5000)], DEMO_BRIEF),
      ).not.toThrow();
    },
  );

  it("requests revision even for an overrun of one cent", () => {
    expect(
      detectConflicts([proposal("accommodation", 1000.01)], { ...DEMO_BRIEF, budgetTotal: 1000 }),
    ).toHaveLength(1);
    expect(
      detectConflicts([proposal("accommodation", 1000)], { ...DEMO_BRIEF, budgetTotal: 1000 }),
    ).toEqual([]);
  });

  it("keeps the existing targeting of the two most expensive agents", () => {
    const requests = detectConflicts(
      [proposal("itinerary", 200), proposal("transport", 1890), proposal("accommodation", 2600)],
      DEMO_BRIEF,
    );
    expect(requests.map((request) => request.targetAgent)).toEqual(["accommodation", "transport"]);
    expect(requests[0]!.reason).toContain("17.25%");
  });
});

describe("accommodation integration with negotiation", () => {
  it("converges with selected hotel prices and the dining budget envelope", async () => {
    const plan = await runOrchestrator(DEMO_BRIEF);
    expect(plan.round).toBe(2);
    expect(plan.estTotal).toBe(3930);
    expect(plan.sections.find((section) => section.id === "dining")!.estCost).toBe(700);
    expect(plan.sections.find((section) => section.id === "accommodation")!.estCost).toBe(1480);
    // Converged with no unresolved request, so every section is a draft. There is
    // no longer a "needs you" state driven by a confirmation checkpoint.
    expect(plan.conflicts).toEqual([]);
    expect(plan.sections.every((section) => section.status === "draft")).toBe(true);
  });

  it("stops at K=3 and escalates when the cheapest valid plan is still too expensive", async () => {
    const plan = await runOrchestrator({ ...DEMO_BRIEF, budgetTotal: 1200 });
    expect(plan.round).toBe(3);
    expect(plan.estTotal).toBe(3470);
    expect(plan.conflicts?.some((request) => request.targetAgent === "accommodation")).toBe(true);
    expect(plan.sections.find((section) => section.id === "accommodation")!.status).toBe(
      "needs_you",
    );
  });

  it("also escalates an unresolved sub-10% overrun instead of silently accepting it", async () => {
    const plan = await runOrchestrator({ ...DEMO_BRIEF, budgetTotal: 3800 });
    expect(plan.round).toBe(3);
    expect(plan.overrunPct).toBeGreaterThan(0);
    expect(plan.overrunPct).toBeLessThan(10);
    expect((plan.conflicts?.length ?? 0) > 0).toBe(true);
  });
});
