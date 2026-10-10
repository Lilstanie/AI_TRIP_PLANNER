import type {
  AgentLabCompletedRunArtifact,
  AgentLabRejectionReason,
  AgentLabFailedRunArtifact,
  AgentLabFaultCapability,
  AgentLabFaultProfileId,
  AgentLabRunEvent,
  AgentLabScenarioId,
  AgentLabStrategyId,
} from "@trip/shared";

export type RunState = "ready" | "running" | "cancelled" | "complete" | "error" | "rejected";

export interface RunView {
  state: RunState;
  events: AgentLabRunEvent[];
  artifact?: AgentLabCompletedRunArtifact;
  failure?: AgentLabFailedRunArtifact;
  error?: string;

  rejection?: { reason: AgentLabRejectionReason; message: string; retryAfterSeconds?: number };

  replay?: { runId: string; startedAt: string; total: number };
}

export const emptyRun = (): RunView => ({ state: "ready", events: [] });

export const faultKey = (id: AgentLabFaultProfileId) => `fault:${id}` as const;

export interface FaultProfileSummary {
  id: AgentLabFaultProfileId;
  title: string;
  summary: string;
  capability: AgentLabFaultCapability;
  scenarioId: AgentLabScenarioId;
  strategyId: AgentLabStrategyId;
  expected: "degraded" | "partial" | "terminal";
}
