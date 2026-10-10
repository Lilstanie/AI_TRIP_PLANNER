import { TripPlan, type Currency } from "@trip/shared";
import { detectConflicts, rollUpCost } from "@trip/orchestrator/plan-totals";

export function settlePlan(plan: TripPlan, baseVersion: number, currency: Currency): void {
  plan.conflicts = detectConflicts(
    plan.sections.flatMap((s) => (s.proposal ? [s.proposal] : [])),
    plan.brief,
    currency,
  );

  plan.sections.forEach((section) => {
    section.status = plan.conflicts?.some((c) => c.targetAgent === section.id)
      ? "needs_you"
      : "draft";
  });

  plan.sections.forEach((s) => {
    if (s.proposal)
      s.estCost = s.proposal.items
        .filter((i) => !(i.kind === "activity" && i.day === undefined))
        .reduce((sum, i) => sum + (i.estCost ?? 0), 0);
  });
  plan.budgetTotal = plan.brief.budgetTotal;

  Object.assign(plan, rollUpCost(plan.sections, plan.budgetTotal));
  plan.editVersion = baseVersion + 1;
}
