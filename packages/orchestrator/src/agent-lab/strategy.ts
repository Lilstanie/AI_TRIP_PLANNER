import type {
  AgentLabActor,
  AgentLabEventPayload,
  AgentLabStrategyId,
  TripPlan,
} from "@trip/shared";
import type { AgentLabScenario } from "./scenarios";

export interface AgentLabStrategyContext {
  scenario: AgentLabScenario;
  signal: AbortSignal;
  /** Publishes one trace event; resolves once the event has been delivered and paced. */
  emit: (event: AgentLabEventPayload) => Promise<void>;
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
  /**
   * Whether this strategy has a live implementation. The scripted baseline replays a recording, so a live
   * request for it would label a recording as live; it is refused instead.
   */
  live: boolean;
}
