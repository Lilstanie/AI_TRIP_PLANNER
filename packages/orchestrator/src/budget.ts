// Owner: C — AUD totals and budget policy. A owns the revision loop that negotiates overruns.
import type { AgentProposal, TripSection } from "@trip/shared";

// Any overrun should be negotiated; >10% is the explicit budget red line.
// After K rounds the workflow stops revising and leaves any unresolved conflict on the plan, even
// below this red line.
export const NEGOTIATION_OVERRUN_PCT = 0;
export const ESCALATION_OVERRUN_PCT = 10;

function cents(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error("Costs must be finite, non-negative AUD amounts.");
  const value = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(value)) throw new Error("AUD amount exceeds supported precision.");
  return value;
}

export function sumMoney(amounts: number[]): number {
  const total = amounts.reduce((sum, amount) => sum + cents(amount), 0);
  if (!Number.isSafeInteger(total)) throw new Error("AUD total exceeds supported precision.");
  return total / 100;
}

/**
 * A single agent returning a nonsense `estCost` (negative / NaN / Infinity) must
 * not throw and take down the whole plan. Treat it as 0 — the proposal `detail`
 * still records what the agent actually proposed, and the section shows $0.
 */
function safeCost(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function costOf(proposal: AgentProposal): number {
  return sumMoney(proposal.items.map((item) => safeCost(item.estCost)));
}

export function assessBudget(
  amounts: number[],
  budgetTotal: number,
): {
  estTotal: number;
  overrunPct: number;
} {
  const budgetCents = cents(budgetTotal);
  if (budgetCents <= 0) throw new Error("Total budget must be at least AUD 0.01.");
  const estTotal = sumMoney(amounts);
  // Do not round percentages before policy checks: 10.004% is still >10%.
  const overrunPct = ((cents(estTotal) - budgetCents) / budgetCents) * 100;
  return { estTotal, overrunPct };
}

export function rollUpCost(sections: TripSection[], budgetTotal: number) {
  return assessBudget(
    sections.map((section) => section.estCost),
    budgetTotal,
  );
}
