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

/** One run as the page holds it: the events so far, and the artifact it ended in. */
export interface RunView {
  state: RunState;
  events: AgentLabRunEvent[];
  artifact?: AgentLabCompletedRunArtifact;
  failure?: AgentLabFailedRunArtifact;
  error?: string;
  // Set when the server turned the request away before a run started: not a failed experiment.
  rejection?: { reason: AgentLabRejectionReason; message: string; retryAfterSeconds?: number };
  // Set when the events come from a recorded artifact rather than a run on this page.
  replay?: { runId: string; startedAt: string; total: number };
}

export const emptyRun = (): RunView => ({ state: "ready", events: [] });

/** Fault runs live beside strategy runs, so their keys never collide with a strategy id. */
export const faultKey = (id: AgentLabFaultProfileId) => `fault:${id}` as const;

/** A registered fault, as the server describes it to the page. */
export interface FaultProfileSummary {
  id: AgentLabFaultProfileId;
  title: string;
  summary: string;
  capability: AgentLabFaultCapability;
  scenarioId: AgentLabScenarioId;
  strategyId: AgentLabStrategyId;
  expected: "degraded" | "partial" | "terminal";
}
