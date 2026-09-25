import type { AgentName, AgentProposal, TripBrief, RevisionRequest } from "@trip/shared";
import { assessBudget, costOf, NEGOTIATION_OVERRUN_PCT } from "./budget";

/** Reason prefix of the one conflict that ends the loop: no revision can meet the budget. */
export const INFEASIBLE_BUDGET = "infeasible budget";

export const isInfeasible = (request: RevisionRequest) =>
  request.reason.startsWith(INFEASIBLE_BUDGET);

const cents = (amount: number) => Math.ceil(amount * 100) / 100;
const aud = (amount: number) => `AUD ${amount.toFixed(2)}`;

/**
 * The lowest the plan can cost from the options the specialists found: each
 * section at its floor, or free when it could not name one (activities and
 * meals can always be scaled down to nothing).
 */
export function minimumCost(proposals: AgentProposal[]): number {
  return proposals.reduce((sum, proposal) => sum + Math.min(costOf(proposal), proposal.floorCost ?? 0), 0);
}

export function detectConflicts(proposals: AgentProposal[], brief: TripBrief): RevisionRequest[] {
  const { estTotal, overrunPct } = assessBudget(proposals.map(costOf), brief.budgetTotal);
  const pending = new Map<AgentName, { reasons: string[]; constraints: string[]; targetSaving?: number }>();
  const add = (agent: AgentName, reason: string, constraint: string, targetSaving?: number) => {
    const entry = pending.get(agent) ?? { reasons: [], constraints: [] };
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    if (!entry.constraints.includes(constraint)) entry.constraints.push(constraint);
    if (targetSaving !== undefined) entry.targetSaving = targetSaving;
    pending.set(agent, entry);
  };

  if (overrunPct > NEGOTIATION_OVERRUN_PCT) {
    const overrun = estTotal - brief.budgetTotal;
    const floor = minimumCost(proposals);
    if (floor > brief.budgetTotal) {
      // Revising cannot help: even the cheapest options found exceed the
      // budget. Say so once, with the number, instead of burning every round.
      const largest = [...proposals].sort((left, right) => costOf(right) - costOf(left))[0]!;
      return [
        {
          tripId: brief.tripId,
          targetAgent: largest.agent,
          reason: `${INFEASIBLE_BUDGET}: the cheapest flights and stays found already cost ${aud(floor)}, above the ${aud(brief.budgetTotal)} budget`,
          constraints: [
            `raise the budget to at least ${aud(floor)} (from the options found, before activities and meals), or change dates, origin or destination`,
          ],
        },
      ];
    }
    // Spread the actual overrun over what each section can still give up, so a
    // 500% overrun and a 4% one are not both answered with "cut 30%".
    const reducible = proposals
      .map((proposal) => ({
        proposal,
        room: costOf(proposal) - Math.min(costOf(proposal), proposal.floorCost ?? 0),
      }))
      .filter(({ room }) => room > 0);
    const room = reducible.reduce((sum, entry) => sum + entry.room, 0);
    for (const { proposal, room: own } of reducible) {
      const saving = cents(Math.min(own, (overrun * own) / room));
      if (saving <= 0) continue;
      add(
        proposal.agent,
        `plan is ${overrunPct.toFixed(2)}% (${aud(overrun)}) over budget`,
        `cut ${proposal.agent} cost by ${aud(saving)}, to at most ${aud(costOf(proposal) - saving)}`,
        saving,
      );
    }
  }

  for (const proposal of proposals) {
    for (const reason of proposal.conflictsWith) {
      add(proposal.agent, reason, "make the route geographically feasible");
    }
  }

  const scheduled = proposals.flatMap((proposal) =>
    proposal.items.flatMap((item) =>
      item.day !== undefined && item.startTime && item.endTime
        ? [{ agent: proposal.agent, item }]
        : [],
    ),
  );
  const toMinutes = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour! * 60 + minute!;
  };
  for (let leftIndex = 0; leftIndex < scheduled.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < scheduled.length; rightIndex += 1) {
      const left = scheduled[leftIndex]!;
      const right = scheduled[rightIndex]!;
      if (left.item.day !== right.item.day) continue;
      const overlaps =
        toMinutes(left.item.startTime!) < toMinutes(right.item.endTime!) &&
        toMinutes(right.item.startTime!) < toMinutes(left.item.endTime!);
      if (!overlaps) continue;
      // A deliberate asymmetry: when an activity collides with anything else, only the
      // itinerary is asked to move. A flight or a train leaves when it leaves; a museum
      // visit does not. Keep it -- "fixing" this into a symmetric rule asks both sides to
      // reschedule around each other and can oscillate for every remaining round.
      // `conflicts.test.ts` locks this semantics, now that transport picks its own times.
      const targets =
        left.agent === "itinerary" || right.agent === "itinerary"
          ? (["itinerary"] as const)
          : ([left.agent, right.agent] as const);
      const reason = `time overlap on day ${left.item.day}: ${left.item.startTime}-${left.item.endTime} conflicts with ${right.item.startTime}-${right.item.endTime}`;
      for (const target of new Set<AgentName>(targets)) {
        // A revising agent only sees its own proposal, so name the window it has
        // to work around and who owns it. Without this it is guessing, and the
        // graph burns every remaining round without converging.
        const blocker = target === left.agent ? right : left;
        add(
          target,
          reason,
          `on day ${left.item.day} keep clear of ${blocker.item.startTime}-${blocker.item.endTime}, held by ${blocker.agent}${
            blocker.item.location ? ` (${blocker.item.location})` : ""
          }; reschedule without changing trip dates`,
        );
      }
    }
  }

  return [...pending].map(([targetAgent, value]) => ({
    tripId: brief.tripId,
    targetAgent,
    reason: value.reasons.join("; "),
    constraints: value.constraints,
    ...(value.targetSaving !== undefined ? { targetSaving: value.targetSaving } : {}),
  }));
}
