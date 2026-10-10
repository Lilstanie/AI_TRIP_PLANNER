import { formatMoney } from "@trip/shared";
import type {
  AgentName,
  Currency,
  AgentProposal,
  BudgetAllocation,
  PlanningBoard,
  SpecialistRequest,
  TripBrief,
} from "@trip/shared";
import { costOf } from "./budget";

const WAITS_FOR: Partial<Record<AgentName, readonly AgentName[]>> = {
  accommodation: ["transport"],
  itinerary: ["transport", "accommodation"],
  dining: ["transport", "accommodation"],
};

const SHARES: Partial<Record<AgentName, number>> = {
  accommodation: 0.4,
  itinerary: 0.4,
  dining: 0.2,
};

export function allocationFor(
  agent: AgentName,
  brief: TripBrief,
  proposals: ReadonlyMap<AgentName, AgentProposal>,
  currency: Currency = "AUD",
): BudgetAllocation | undefined {
  const aud = (amount: number) => formatMoney(amount, currency, "whole");
  const share = SHARES[agent];
  if (share === undefined) return undefined;
  const settled = (WAITS_FOR[agent] ?? []).filter((name) => proposals.has(name));
  const spent = settled.reduce((sum, name) => sum + costOf(proposals.get(name)!), 0);
  const remaining = Math.max(0, brief.budgetTotal - spent);

  const open = (Object.keys(SHARES) as AgentName[]).filter((name) => !settled.includes(name));
  const weight = open.reduce((sum, name) => sum + SHARES[name]!, 0);
  const budget = Math.floor(((remaining * share) / weight) * 100) / 100;
  const after = settled.length ? ` after ${settled.join(" and ")} (${aud(spent)})` : "";
  return {
    budget,
    basis: `${aud(budget)} of the ${aud(remaining)} left${after} from the ${aud(brief.budgetTotal)} budget`,
  };
}

export function createPlanningBoard(brief: TripBrief, currency: Currency = "AUD") {
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
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.all(
          (WAITS_FOR[agent] ?? []).flatMap((name) => {
            const pending = running.get(name);
            return pending ? [pending] : [];
          }),
        );
        const allocation = allocationFor(agent, brief, proposals, currency);
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
