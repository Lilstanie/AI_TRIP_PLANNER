// Failure inventory, written before the evaluator:
// - a plan over budget still reports withinBudget, or reports positive headroom;
// - an activity before the scenario's earliest start passes;
// - a meal that is not marked vegetarian-friendly passes;
// - a plan with fewer than five sections or with conflicts passes;
// - a plan for another destination passes, or the check is tied to the literal "Tokyo" instead of
//   the scenario's brief;
// - the reported pass count disagrees with the individual checks the visitor is shown.
import { describe, expect, it } from "vitest";
import type { TripPlan } from "@trip/shared";
import { evaluateAgentLabPlan, findAgentLabScenario } from "../src/agent-lab";

const scenario = findAgentLabScenario("tokyo-couple");
const clone = (): TripPlan => structuredClone(scenario.fixturePlan);
const failed = (plan: TripPlan) =>
  evaluateAgentLabPlan(scenario, plan)
    .checks.filter((check) => !check.passed)
    .map((check) => check.id);

describe("evaluateAgentLabPlan", () => {
  it("passes every check for the registered fixture", () => {
    const result = evaluateAgentLabPlan(scenario, clone());
    expect(failed(scenario.fixturePlan)).toEqual([]);
    expect(result.withinBudget).toBe(true);
    expect(result.budgetHeadroom).toBe(2040);
    expect(result.checks.length).toBeGreaterThanOrEqual(6);
    expect(new Set(result.checks.map((check) => check.id)).size).toBe(result.checks.length);
  });

  it("reports an overrun as over budget with negative headroom", () => {
    const plan = clone();
    plan.estTotal = 6500;
    const result = evaluateAgentLabPlan(scenario, plan);
    expect(result.withinBudget).toBe(false);
    expect(result.budgetHeadroom).toBe(-500);
    expect(failed(plan)).toEqual(["budget"]);
  });

  it("fails an activity that starts before the earliest allowed time", () => {
    const plan = clone();
    plan.sections[0]!.proposal!.items[0]!.startTime = "07:00";
    expect(failed(plan)).toEqual(["no-early-starts"]);
  });

  it("fails a meal that is not marked vegetarian-friendly", () => {
    const plan = clone();
    const dining = plan.sections.find((section) => section.id === "dining")!;
    dining.proposal!.items[0]!.detail = "Steakhouse dinner for two";
    expect(failed(plan)).toEqual(["vegetarian-meals"]);
  });

  it("fails a plan with a missing section", () => {
    const plan = clone();
    plan.sections = plan.sections.slice(0, 4);
    expect(failed(plan)).toContain("sections");
  });

  it("fails a plan that carries conflicts", () => {
    const plan = clone();
    plan.conflicts = [
      { tripId: plan.tripId, targetAgent: "transport", reason: "over budget", constraints: [] },
    ];
    expect(failed(plan)).toEqual(["no-conflicts"]);
  });

  it("fails a plan for a different destination using the scenario brief, not a literal", () => {
    const plan = clone();
    plan.brief = { ...plan.brief, destination: "Osaka" };
    expect(failed(plan)).toEqual(["destination"]);
  });
});
