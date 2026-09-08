// @trip/orchestrator — the hand-rolled negotiation loop (Owner: A).
// The LangGraph version lives in @trip/graph and reuses ./steps + detectConflicts,
// so switching implementations is a flag, not a rewrite. See README §1.
import type { AgentProposal, RevisionRequest, TripBrief, TripPlan } from "@trip/shared";
import { assessBudget, costOf, NEGOTIATION_OVERRUN_PCT } from "./budget";
import { MAX_ROUNDS, applyRevisions, assemblePlan, createRunContext, dispatch } from "./steps";

export { DEMO_BRIEF } from "./demo";
export { rollUpCost } from "./budget";
export * from "./steps";

export async function runOrchestrator(brief: TripBrief): Promise<TripPlan> {
  const ctx = createRunContext(brief);

  // --- Round 1: dispatch the brief to every agent in parallel ---------------
  let round = 1;
  let proposals = await dispatch(brief, ctx(round));

  // --- Rounds 2..K: revise on conflict -------------------------------------
  let conflicts = detectConflicts(proposals, brief);
  while (conflicts.length > 0 && round < MAX_ROUNDS) {
    round += 1;
    proposals = await applyRevisions(brief, ctx(round), proposals, conflicts);
    conflicts = detectConflicts(proposals, brief);
  }

  // --- Aggregate ----------------------------------------------------------
  return assemblePlan(brief, proposals, conflicts, round);
}

// ---------------------------------------------------------------------------
// Conflict detection.
// Implemented: budget overrun -> ask the two priciest agents to cut.
// TODO(A): add time + geo conflicts — call the TransportAgent helper (B) for
//          overlapping / too-far-apart same-day items and return one
//          RevisionRequest per affected agent.
// ---------------------------------------------------------------------------
export function detectConflicts(proposals: AgentProposal[], brief: TripBrief): RevisionRequest[] {
  const { overrunPct } = assessBudget(proposals.map(costOf), brief.budgetTotal);
  if (overrunPct <= NEGOTIATION_OVERRUN_PCT) return [];

  return [...proposals]
    .filter((p) => costOf(p) > 0)
    .sort((a, b) => costOf(b) - costOf(a))
    .slice(0, 2)
    .map((p) => ({
      tripId: brief.tripId,
      targetAgent: p.agent,
      reason: `plan is ${overrunPct.toFixed(2)}% over budget`,
      constraints: [`cut ${p.agent} cost by ~30%`],
    }));
}
