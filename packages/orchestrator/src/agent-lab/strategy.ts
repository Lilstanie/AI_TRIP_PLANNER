import type {
  AgentLabActor,
  AgentLabEventPayload,
  AgentLabStrategyId,
  TripPlan,
} from "@trip/shared";
import type { AgentLabFaultProfile } from "./fault-profiles";
import type { AgentLabScenario } from "./scenarios";

export interface AgentLabStrategyContext {
  scenario: AgentLabScenario;
  signal: AbortSignal;

  emit: (event: AgentLabEventPayload) => Promise<void>;

  fault?: AgentLabFaultProfile;
}

export interface AgentLabStrategy {
  id: AgentLabStrategyId;
  actor: AgentLabActor;
  run: (context: AgentLabStrategyContext) => Promise<TripPlan>;

  completionSummary: (plan: TripPlan) => string;

  live: boolean;
}
