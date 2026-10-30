import { outboundArrival } from "@trip/agents";
import { formatMoney } from "@trip/shared";
import type { AgentName, Currency, AgentProposal, TripBrief, RevisionRequest } from "@trip/shared";
import { assessBudget, costOf, moneyDifference, NEGOTIATION_OVERRUN_PCT, sumMoney } from "./budget";

export const INFEASIBLE_BUDGET = "infeasible budget";

export const isInfeasible = (request: RevisionRequest) => request.kind === "infeasible";

type RevisionKind = RevisionRequest["kind"];

const KIND_RANK: Record<RevisionKind, number> = {
  request: 0,
  geography: 1,
  time: 2,
  budget: 3,
  infeasible: 4,
};

const cents = (amount: number) => Math.ceil(amount * 100) / 100;

export function minimumCost(proposals: AgentProposal[]): number {
  return sumMoney(proposals.map((proposal) => Math.min(costOf(proposal), proposal.floorCost ?? 0)));
}

export function detectConflicts(
  proposals: AgentProposal[],
  brief: TripBrief,
  currency: Currency = "AUD",
): RevisionRequest[] {
  const aud = (amount: number) => formatMoney(amount, currency);
  const { estTotal, overrunPct } = assessBudget(proposals.map(costOf), brief.budgetTotal);
  const pending = new Map<
    AgentName,
    { kind: RevisionKind; reasons: string[]; constraints: string[]; targetSaving?: number }
  >();
  const add = (
    agent: AgentName,
    kind: RevisionKind,
    reason: string,
    constraint: string,
    targetSaving?: number,
  ) => {
    const entry = pending.get(agent) ?? { kind, reasons: [], constraints: [] };
    if (KIND_RANK[kind] > KIND_RANK[entry.kind]) entry.kind = kind;
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    if (!entry.constraints.includes(constraint)) entry.constraints.push(constraint);
    if (targetSaving !== undefined) entry.targetSaving = targetSaving;
    pending.set(agent, entry);
  };

  if (overrunPct > NEGOTIATION_OVERRUN_PCT) {
    const overrun = moneyDifference(estTotal, brief.budgetTotal);
    const floor = minimumCost(proposals);
    if (moneyDifference(floor, brief.budgetTotal) > 0) {
      const largest = [...proposals].sort((left, right) => costOf(right) - costOf(left))[0]!;
      return [
        {
          tripId: brief.tripId,
          targetAgent: largest.agent,
          kind: "infeasible",
          reason: `${INFEASIBLE_BUDGET}: the cheapest flights and stays found already cost ${aud(floor)}, above the ${aud(brief.budgetTotal)} budget`,
          constraints: [
            `raise the budget to at least ${aud(floor)} (from the options found, before activities and meals), or change dates, origin or destination`,
          ],
        },
      ];
    }

    const reducible = proposals
      .map((proposal) => ({
        proposal,
        room: moneyDifference(
          costOf(proposal),
          Math.min(costOf(proposal), proposal.floorCost ?? 0),
        ),
      }))
      .filter(({ room }) => room > 0);
    const room = reducible.reduce((sum, entry) => sum + entry.room, 0);
    for (const { proposal, room: own } of reducible) {
      const saving = cents(Math.min(own, (overrun * own) / room));
      if (saving <= 0) continue;
      add(
        proposal.agent,
        "budget",
        `plan is ${overrunPct.toFixed(2)}% (${aud(overrun)}) over budget`,
        `cut ${proposal.agent} cost by ${aud(saving)}, to at most ${aud(moneyDifference(costOf(proposal), saving))}`,
        saving,
      );
    }
  }

  for (const proposal of proposals) {
    for (const reason of proposal.conflictsWith) {
      add(proposal.agent, "geography", reason, "make the route geographically feasible");
    }
  }

  const arrival = proposals
    .find((proposal) => proposal.agent === "transport")
    ?.flights?.find(
      (flight) =>
        flight.id === "flight-0" &&
        flight.depart === brief.dates[0] &&
        flight.to.trim().toLowerCase() === brief.destination.split("&")[0]?.trim().toLowerCase(),
    );
  const landing = outboundArrival(brief, proposals);
  if (landing) {
    const { day: arrivalDay, time: arrivalTime } = landing;
    const activities = proposals.find((proposal) => proposal.agent === "itinerary")?.items ?? [];
    for (const item of activities) {
      if (
        item.day === undefined ||
        !item.startTime ||
        item.day > arrivalDay ||
        (item.day === arrivalDay && item.startTime >= arrivalTime)
      )
        continue;
      add(
        "itinerary",
        "time",
        `activity on day ${item.day} starts before the flight arrives on day ${arrivalDay} at ${arrivalTime}`,
        `schedule destination activities after arrival on day ${arrivalDay} at ${arrivalTime}`,
      );
    }
  }

  const scheduled = proposals.flatMap((proposal) =>
    proposal.items.flatMap((item) =>
      item.day !== undefined &&
      item.startTime &&
      item.endTime &&
      !(proposal.agent === "transport" && arrival && item.selectionId === arrival.id)
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

      const targets =
        left.agent === "itinerary" || right.agent === "itinerary"
          ? (["itinerary"] as const)
          : ([left.agent, right.agent] as const);
      const reason = `time overlap on day ${left.item.day}: ${left.item.startTime}-${left.item.endTime} conflicts with ${right.item.startTime}-${right.item.endTime}`;
      for (const target of new Set<AgentName>(targets)) {
        const blocker = target === left.agent ? right : left;
        add(
          target,
          "time",
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
    kind: value.kind,
    reason: value.reasons.join("; "),
    constraints: value.constraints,
    ...(value.targetSaving !== undefined ? { targetSaving: value.targetSaving } : {}),
  }));
}
