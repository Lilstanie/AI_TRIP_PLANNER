import type {
  AgentLabFaultCapability,
  AgentLabFaultProfileId,
  AgentLabRunRequest,
  AgentLabScenarioId,
  AgentLabStrategyId,
} from "@trip/shared";

/**
 * What the workflow does with a fault, observed from the real workflow rather than assumed: it carries
 * on with a degraded section, it keeps a partial result, or it stops.
 */
export type AgentLabFaultBehaviour = "degraded" | "partial" | "terminal";

/**
 * A registered, deterministic fault. A visitor names one by id and never defines a fault of their own;
 * each is bound to the one scenario and strategy it was built for, so the run is repeatable.
 */
export interface AgentLabFaultProfile {
  id: AgentLabFaultProfileId;
  title: string;
  summary: string;
  /** Where the fault is injected. */
  capability: AgentLabFaultCapability;
  scenarioId: AgentLabScenarioId;
  strategyId: AgentLabStrategyId;
  expected: AgentLabFaultBehaviour;
}

export const agentLabFaultProfiles: readonly AgentLabFaultProfile[] = [
  {
    id: "provider-timeout",
    title: "Flight provider timeout",
    summary:
      "The transport specialist's flight search times out. Its section degrades to unavailable instead of being priced, and the conflict this leaves stays visible.",
    capability: "transport",
    scenarioId: "tokyo-couple",
    strategyId: "multi-agent-no-revision",
    expected: "degraded",
  },
  {
    id: "provider-empty-result",
    title: "Empty stay search",
    summary:
      "The accommodation specialist's stay search returns nothing. The workflow stops instead of inventing a stay.",
    capability: "accommodation",
    scenarioId: "tokyo-couple",
    strategyId: "multi-agent-no-revision",
    expected: "terminal",
  },
  {
    id: "invalid-agent-output",
    title: "Invalid specialist output",
    summary:
      "The dining specialist returns a proposal that breaks the shared schema. It is rejected at the boundary and the run stops before any plan is assembled.",
    capability: "dining",
    scenarioId: "tokyo-couple",
    strategyId: "multi-agent-no-revision",
    expected: "terminal",
  },
  {
    id: "supervisor-failure",
    title: "Supervisor failure",
    summary:
      "The supervisor delegates to no one, skipping the day plan the trip cannot do without. The workflow falls back to dispatching the five specialists deterministically.",
    capability: "supervisor",
    scenarioId: "tokyo-couple",
    strategyId: "multi-agent-no-revision",
    expected: "degraded",
  },
  {
    id: "stalled-revision",
    title: "Stalled revision",
    summary:
      "On the tight budget, the transport specialist's revision cannot improve the plan. The best known plan is kept and the loop stops.",
    capability: "transport",
    scenarioId: "tokyo-couple-tight-budget",
    strategyId: "multi-agent-targeted-revision",
    expected: "partial",
  },
];

export const agentLabFaultProfileSummaries = agentLabFaultProfiles;

export function findAgentLabFaultProfile(id: AgentLabFaultProfileId): AgentLabFaultProfile {
  const profile = agentLabFaultProfiles.find((candidate) => candidate.id === id);
  if (!profile) throw new Error(`Unknown Agent Lab fault profile: ${id}`);
  return profile;
}

/**
 * Whether a request names a run the server registered. An ordinary request always is; a request with a
 * fault must match the scenario and strategy that fault was built for.
 */
export function isRegisteredAgentLabRun(request: AgentLabRunRequest): boolean {
  if (request.faultProfileId === undefined) return true;
  const profile = agentLabFaultProfiles.find(
    (candidate) => candidate.id === request.faultProfileId,
  );
  return (
    profile !== undefined &&
    profile.scenarioId === request.scenarioId &&
    profile.strategyId === request.strategyId &&
    request.dataMode === "fixture"
  );
}
