import {
  TripPlan,
  type AgentLabLifecycleEvent,
  type TripPlan as TripPlanValue,
} from "@trip/shared";
import type { AgentLabScenario } from "./scenarios";

export interface AgentLabStrategyContext {
  scenario: AgentLabScenario;
  signal: AbortSignal;
  emit: (event: AgentLabLifecycleEvent) => Promise<void>;
}

export interface AgentLabStrategy {
  id: "single-agent-baseline";
  run: (context: AgentLabStrategyContext) => Promise<TripPlanValue>;
}

export const singleAgentFixtureStrategy: AgentLabStrategy = {
  id: "single-agent-baseline",
  async run({ scenario, signal, emit }) {
    signal.throwIfAborted();
    await emit({
      type: "lab_strategy_started",
      actor: "single-agent",
      objective: "Produce one complete, validated trip plan from the registered scenario evidence.",
      constraints: [
        `Keep the whole trip within A$${scenario.brief.budgetTotal.toLocaleString("en-AU")}.`,
        ...(scenario.rules.vegetarianMeals ? ["Mark every meal as vegetarian-friendly."] : []),
        `Start no activity before ${scenario.rules.earliestStartTime}.`,
        `Return all ${scenario.rules.sectionCount} comparable plan sections.`,
      ],
    });
    await emit({
      type: "lab_tool_started",
      callId: "fixture-evidence-1",
      tool: "load_registered_scenario",
      label: "Load fixture evidence",
      summary: "Read the fixed Tokyo planning evidence available to this strategy.",
    });
    signal.throwIfAborted();
    await emit({
      type: "lab_tool_completed",
      callId: "fixture-evidence-1",
      tool: "load_registered_scenario",
      label: "Fixture evidence loaded",
      resultSummary: "Loaded transport, stay, activity, destination and dining evidence.",
      resultCount: 5,
    });
    signal.throwIfAborted();
    return TripPlan.parse(scenario.fixturePlan);
  },
};
