import type { TripBrief, AgentProposal, RevisionRequest, AgentName } from "./contracts";
import { effectiveCurrency, type Currency } from "./money";
import type { ToolGateway, MemoryStore } from "./ports";

export interface AgentContext {
  tripId: string;
  round: number;

  tools: ToolGateway;

  mem: MemoryStore;
  signal?: AbortSignal;

  displayCurrency?: Currency;
}

export function displayCurrencyOf(brief: TripBrief, context?: AgentContext): Currency {
  return context?.displayCurrency ?? effectiveCurrency(brief, "AUD");
}

export interface SpecialistRequest {
  readonly brief: TripBrief;
  readonly context: AgentContext;
  readonly revision?: RevisionRequest;

  readonly board?: PlanningBoard;

  readonly allocation?: BudgetAllocation;

  readonly previous?: AgentProposal;
}

export interface PlanningBoard {
  readonly proposals: readonly AgentProposal[];
}

export interface BudgetAllocation {
  readonly budget: number;

  readonly basis: string;
}

export interface Specialist {
  name: AgentName;

  label: string;

  supportsRevision?: boolean;

  invoke(request: SpecialistRequest): Promise<AgentProposal>;
}
