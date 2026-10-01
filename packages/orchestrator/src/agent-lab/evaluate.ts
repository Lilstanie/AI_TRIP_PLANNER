import type { AgentLabCheck, AgentLabMetrics, TripPlan } from "@trip/shared";
import type { AgentLabScenario } from "./scenarios";

export type AgentLabEvaluation = Pick<
  AgentLabMetrics,
  "withinBudget" | "budgetHeadroom" | "sectionCount" | "checks"
>;

const money = (value: number) => `A$${value.toLocaleString("en-AU")}`;

/**
 * Measures a plan against the scenario's own constraints. Every check is deterministic and named, so the
 * inspector can show what was measured. Vegetarian is checked as "each meal is marked vegetarian-friendly"
 * because the plan carries no dietary data beyond its own wording.
 */
export function evaluateAgentLabPlan(
  scenario: AgentLabScenario,
  plan: TripPlan,
): AgentLabEvaluation {
  const { rules, brief } = scenario;
  const proposals = plan.sections.flatMap((section) =>
    section.proposal ? [section.proposal] : [],
  );
  const items = proposals.flatMap((proposal) => proposal.items);
  // "HH:MM" strings compare correctly as text.
  const startsEarly = items.some(
    (item) => item.startTime !== undefined && item.startTime < rules.earliestStartTime,
  );
  const meals = items.filter((item) => item.kind === "meal");
  const withinBudget = plan.estTotal <= plan.budgetTotal;

  const checks: AgentLabCheck[] = [
    {
      id: "sections",
      label: `All ${rules.sectionCount} comparable plan sections are present`,
      passed: plan.sections.length === rules.sectionCount,
    },
    {
      id: "budget",
      label: `Estimate stays within the ${money(plan.budgetTotal)} budget`,
      passed: withinBudget,
    },
    {
      id: "no-conflicts",
      label: "No unresolved cross-section conflicts",
      passed: (plan.conflicts?.length ?? 0) === 0,
    },
    {
      id: "destination",
      label: `Plan is for ${brief.destination}`,
      passed: plan.brief.destination === brief.destination,
    },
    {
      id: "no-early-starts",
      label: `No activity starts before ${rules.earliestStartTime}`,
      passed: !startsEarly,
    },
  ];
  if (rules.vegetarianMeals) {
    checks.push({
      id: "vegetarian-meals",
      label: "Every meal is marked vegetarian-friendly",
      passed: meals.length > 0 && meals.every((meal) => /vegetarian/i.test(meal.detail)),
    });
  }

  return {
    withinBudget,
    budgetHeadroom: plan.budgetTotal - plan.estTotal,
    sectionCount: plan.sections.length,
    checks,
  };
}
