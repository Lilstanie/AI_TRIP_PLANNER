// Owner: A — the reusable steps of the negotiation loop.
// Both the hand-rolled loop (./index) and the LangGraph version (@trip/graph)
// call these, so the two implementations stay behaviourally identical.
import type {
  AgentContext,
  AgentProposal,
  HitlCheckpoint,
  RevisionRequest,
  TripBrief,
  TripPlan,
  TripSection,
} from "@trip/shared";
import { allAgents } from "@trip/agents";
import { createToolGateway } from "@trip/tools";
import { memory } from "@trip/services";
import { costOf, rollUpCost, ESCALATION_OVERRUN_PCT } from "./budget";

export const MAX_ROUNDS = 3; // K
export const AGENT_BY_NAME = new Map(allAgents.map((a) => [a.name, a]));

/** One shared tool gateway + memory store per run; returns a per-round ctx factory. */
export function createRunContext(brief: TripBrief): (round: number) => AgentContext {
  const tools = createToolGateway();
  return (round) => ({ tripId: brief.tripId, round, tools, mem: memory });
}

/** Round 1: dispatch the brief to every agent in parallel. */
export function dispatch(brief: TripBrief, ctx: AgentContext): Promise<AgentProposal[]> {
  return Promise.all(allAgents.map((a) => a.run(brief, ctx)));
}

/** Rounds 2..K: send each RevisionRequest to its target agent's revise() and swap it in. */
export async function applyRevisions(
  brief: TripBrief,
  ctx: AgentContext,
  proposals: AgentProposal[],
  requests: RevisionRequest[],
): Promise<AgentProposal[]> {
  const byName = new Map(proposals.map((p) => [p.agent, p]));
  for (const req of requests) {
    const agent = AGENT_BY_NAME.get(req.targetAgent);
    if (!agent?.revise) continue;
    byName.set(req.targetAgent, await agent.revise(brief, ctx, req));
  }
  return [...byName.values()];
}

export function toSection(p: AgentProposal, unresolved: RevisionRequest[]): TripSection {
  const stillConflicting = unresolved.some((r) => r.targetAgent === p.agent);
  return {
    id: p.agent,
    label: AGENT_BY_NAME.get(p.agent)?.label ?? p.agent,
    summary: p.summary,
    // TODO(A/E): promote to "confirmed" once the user accepts a section.
    status: stillConflicting ? "needs_you" : "draft",
    estCost: costOf(p),
    proposal: p,
  };
}

// TODO(A): richer HITL — per-section confirm, hotel-picker payload, resume tokens.
export function buildHitl(
  brief: TripBrief,
  overrunPct: number,
  unresolved: boolean,
): HitlCheckpoint[] {
  const items: HitlCheckpoint[] = [
    {
      id: "confirm-brief",
      type: "confirm_brief",
      title: "Confirm your trip basics",
      detail: `${brief.destination} · ${brief.dates[0]} to ${brief.dates[1]} · ${brief.groupSize} people · $${brief.budgetTotal}`,
      status: "pending",
    },
  ];
  if (overrunPct > ESCALATION_OVERRUN_PCT || unresolved) {
    items.push({
      id: "escalation",
      type: "escalation",
      title: "Needs a human decision",
      detail: unresolved
        ? `Agents did not converge within ${MAX_ROUNDS} rounds.`
        : `Plan is ${overrunPct.toFixed(2)}% over budget.`,
      status: "pending",
    });
  }
  return items;
}

/** Aggregate the proposals + any unresolved conflicts into the final TripPlan. */
export function assemblePlan(
  brief: TripBrief,
  proposals: AgentProposal[],
  conflicts: RevisionRequest[],
  round: number,
): TripPlan {
  const unresolved = conflicts.length > 0;
  const sections = proposals.map((p) => toSection(p, conflicts));
  const { estTotal, overrunPct } = rollUpCost(sections, brief.budgetTotal);
  return {
    tripId: brief.tripId,
    brief,
    round,
    budgetTotal: brief.budgetTotal,
    estTotal,
    overrunPct,
    sections,
    hitl: buildHitl(brief, overrunPct, unresolved),
  };
}
