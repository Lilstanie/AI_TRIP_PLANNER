import { TripPlan, type Currency } from "@trip/shared";
import { detectConflicts, rollUpCost } from "@trip/orchestrator/plan-totals";

/**
 * Recompute everything an edit can move: conflicts, section status, costs and the version. The server
 * runs it after every timeline edit (`trip-edit.ts`), and the browser runs the same function after an
 * edit it makes without the server (`item-actions.ts`), so the estimate reads the same either way.
 * Every operation ends here, so a new one cannot quietly skip the budget roll-up or leave a stale
 * conflict behind.
 */
export function settlePlan(plan: TripPlan, baseVersion: number, currency: Currency): void {
  plan.conflicts = detectConflicts(
    plan.sections.flatMap((s) => (s.proposal ? [s.proposal] : [])),
    plan.brief,
    currency,
  );
  // A section is unresolved when the recomputed conflicts still target it — the
  // same rule the orchestrator uses. An edit no longer rebuilds a decision list.
  plan.sections.forEach((section) => {
    section.status = plan.conflicts?.some((c) => c.targetAgent === section.id)
      ? "needs_you"
      : "draft";
  });
  // Recompute from item evidence, never trust client totals. An Idea (an activity with no day) is not in the
  // plan's days, so its price is not part of the estimate.
  plan.sections.forEach((s) => {
    if (s.proposal)
      s.estCost = s.proposal.items
        .filter((i) => !(i.kind === "activity" && i.day === undefined))
        .reduce((sum, i) => sum + (i.estCost ?? 0), 0);
  });
  plan.budgetTotal = plan.brief.budgetTotal;
  // Share the orchestrator's calculator rather than keeping a float copy of it here. The two
  // already disagreed by float dust, and converted budgets make fractional cents routine.
  Object.assign(plan, rollUpCost(plan.sections, plan.budgetTotal));
  plan.editVersion = baseVersion + 1;
}
