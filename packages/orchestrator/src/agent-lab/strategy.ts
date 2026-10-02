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
  /** Publishes one trace event; resolves once the event has been delivered and paced. */
  emit: (event: AgentLabEventPayload) => Promise<void>;
  /** The registered fault this run injects, when one was asked for. */
  fault?: AgentLabFaultProfile;
}

/**
 * One way to turn a scenario into a plan. The runner owns validation, evaluation, metrics and the
 * artifact, so every strategy is measured by the same code.
 */
export interface AgentLabStrategy {
  id: AgentLabStrategyId;
  actor: AgentLabActor;
  run: (context: AgentLabStrategyContext) => Promise<TripPlan>;
  /** One sentence for the trace, written after the plan exists. */
  completionSummary: (plan: TripPlan) => string;
}
