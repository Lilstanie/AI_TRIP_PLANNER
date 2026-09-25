import type {
  AgentName,
  AgentProposal,
  BudgetAllocation,
  PlanningBoard,
  SpecialistRequest,
  TripBrief,
} from "@trip/shared";
import { costOf } from "./budget";

/**
 * Which specialists must finish before another may start. Transport is the
 * largest and least negotiable cost, so it goes first; the stay is chosen
 * knowing what flights left, and the day plan and meals know both.
 */
const WAITS_FOR: Partial<Record<AgentName, readonly AgentName[]>> = {
  accommodation: ["transport"],
  itinerary: ["transport", "accommodation"],
  dining: ["transport", "accommodation"],
};

/**
 * How what is left after earlier stages is split between the specialists that
 * still spend it. Itinerary and dining keep the shares they used to take from
 * the whole budget; accommodation, which had none, gets the same as itinerary.
 */
const SHARES: Partial<Record<AgentName, number>> = {
  accommodation: 0.4,
  itinerary: 0.4,
  dining: 0.2,
};

const aud = (amount: number) =>
  `AUD ${amount.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;

/**
 * The spending ceiling for `agent`, from the budget and the proposals already on
 * the board. Undefined for a specialist with no share (transport, the guide).
 */
export function allocationFor(
  agent: AgentName,
  brief: TripBrief,
  proposals: ReadonlyMap<AgentName, AgentProposal>,
): BudgetAllocation | undefined {
  const share = SHARES[agent];
  if (share === undefined) return undefined;
  const settled = (WAITS_FOR[agent] ?? []).filter((name) => proposals.has(name));
  const spent = settled.reduce((sum, name) => sum + costOf(proposals.get(name)!), 0);
  const remaining = Math.max(0, brief.budgetTotal - spent);
  // Only the specialists still to spend compete for what is left.
  const open = (Object.keys(SHARES) as AgentName[]).filter((name) => !settled.includes(name));
  const weight = open.reduce((sum, name) => sum + SHARES[name]!, 0);
  const budget = Math.floor(((remaining * share) / weight) * 100) / 100;
  const after = settled.length ? ` after ${settled.join(" and ")} (${aud(spent)})` : "";
  return {
    budget,
    basis: `${aud(budget)} of the ${aud(remaining)} left${after} from the ${aud(brief.budgetTotal)} budget`,
  };
}

/**
 * The first-round coordination between specialists.
 *
 * The supervisor calls specialist tools in any order, often all in one turn.
 * `run` lets each call wait for the specialists it depends on — but only those
 * already started, so a specialist the supervisor never calls cannot deadlock
 * the rest — and then hands it the board and its allocation.
 */
export function createPlanningBoard(brief: TripBrief) {
  const proposals = new Map<AgentName, AgentProposal>();
  const running = new Map<AgentName, Promise<unknown>>();

  const view = (except: AgentName): PlanningBoard => ({
    proposals: [...proposals.values()].filter((proposal) => proposal.agent !== except),
  });

  return {
    proposals,
    async run(
      agent: AgentName,
      invoke: (extra: Pick<SpecialistRequest, "board" | "allocation">) => Promise<AgentProposal>,
    ): Promise<AgentProposal> {
      let settle!: () => void;
      running.set(agent, new Promise<void>((resolve) => (settle = resolve)));
      try {
        // Sibling tool calls from the same supervisor turn start in the same
        // tick; yielding once lets all of them register before anyone waits.
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.all(
          (WAITS_FOR[agent] ?? []).flatMap((name) => {
            const pending = running.get(name);
            return pending ? [pending] : [];
          }),
        );
        const allocation = allocationFor(agent, brief, proposals);
        const proposal = await invoke({
          board: view(agent),
          ...(allocation ? { allocation } : {}),
        });
        proposals.set(agent, proposal);
        return proposal;
      } finally {
        settle();
      }
    },
  };
}

export type PlanningBoardRun = ReturnType<typeof createPlanningBoard>["run"];
