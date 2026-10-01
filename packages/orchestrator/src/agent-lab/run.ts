import {
  AGENT_LAB_ARTIFACT_SCHEMA_VERSION,
  AgentLabCompletedRunArtifact,
  AgentLabFailedRunArtifact,
  AgentLabRunEvent,
  type AgentLabEventPayload,
  type AgentLabFailedRunArtifact as AgentLabFailedRunArtifactValue,
  type AgentLabRunEvent as AgentLabRunEventValue,
  type AgentLabRunRequest,
  type TripPlan,
} from "@trip/shared";
import { evaluateAgentLabPlan } from "./evaluate";
import { measureAgentLabRun } from "./metrics";
import { findAgentLabScenario } from "./scenarios";
import { findAgentLabStrategy } from "./strategies";

export interface RunAgentLabOptions {
  signal?: AbortSignal;
  onEvent?: (event: AgentLabRunEventValue) => void | Promise<void>;
  paceMs?: number;
  runId?: string;
  startedAtMs?: number;
}

interface CreateFailedArtifactOptions {
  runId: string;
  startedAtMs: number;
  events: AgentLabRunEventValue[];
  message: string;
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException("Agent Lab run cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

export async function runAgentLab(
  request: AgentLabRunRequest,
  options: RunAgentLabOptions = {},
): Promise<AgentLabCompletedRunArtifact> {
  const fallbackController = new AbortController();
  const signal = options.signal ?? fallbackController.signal;
  const scenario = findAgentLabScenario(request.scenarioId);
  const strategy = findAgentLabStrategy(request.strategyId);
  const runId = options.runId ?? `agent-lab-${crypto.randomUUID()}`;
  const startedAtMs = options.startedAtMs ?? Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const events: AgentLabRunEventValue[] = [];
  // Time spent waiting so the stream is watchable. It is part of the run's wall time but not of the
  // strategy's latency, or a strategy that emits more events would look slower for no reason.
  let pacedMs = 0;

  const emit = async (event: AgentLabEventPayload) => {
    signal.throwIfAborted();
    const envelope = AgentLabRunEvent.parse({
      runId,
      sequence: events.length + 1,
      at: new Date().toISOString(),
      elapsedMs: Date.now() - startedAtMs,
      scenarioId: request.scenarioId,
      strategyId: request.strategyId,
      dataMode: request.dataMode,
      event,
    });
    events.push(envelope);
    await options.onEvent?.(envelope);
    const pacingStartedAt = Date.now();
    await abortableDelay(options.paceMs ?? 90, signal);
    pacedMs += Date.now() - pacingStartedAt;
  };

  await emit({
    type: "lab_run_started",
    summary: `Started ${scenario.title} with fixture data.`,
  });
  const plan = await strategy.run({ scenario, signal, emit });
  await emit({
    type: "lab_plan_validated",
    summary: `Validated ${plan.sections.length} plan sections against the shared TripPlan contract.`,
  });
  const evaluated = evaluateAgentLabPlan(scenario, plan);
  const passed = evaluated.checks.filter((check) => check.passed).length;
  await emit({
    type: "lab_evaluation_completed",
    summary: `${passed}/${evaluated.checks.length} baseline checks passed; ${
      evaluated.withinBudget
        ? `A$${evaluated.budgetHeadroom.toLocaleString("en-AU")} remains.`
        : `over budget by A$${(-evaluated.budgetHeadroom).toLocaleString("en-AU")}.`
    }`,
  });
  await emit({
    type: "lab_strategy_completed",
    actor: strategy.actor,
    summary: strategy.completionSummary(plan),
  });
  await emit({
    type: "lab_run_completed",
    summary: "Run complete. The plan, trace and deterministic metrics agree.",
  });

  const completedAtMs = Date.now();
  return AgentLabCompletedRunArtifact.parse({
    schemaVersion: AGENT_LAB_ARTIFACT_SCHEMA_VERSION,
    runId,
    scenarioId: request.scenarioId,
    strategyId: request.strategyId,
    dataMode: request.dataMode,
    status: "completed",
    failure: null,
    startedAt,
    completedAt: new Date(completedAtMs).toISOString(),
    versions: {
      fixture: scenario.fixtureVersion,
      evaluator: "basic-plan-v1",
    },
    events,
    plan,
    metrics: {
      ...measureAgentLabRun(scenario, plan, events),
      durationMs: completedAtMs - startedAtMs,
      latencyMs: Math.max(0, completedAtMs - startedAtMs - pacedMs),
    },
  });
}

export function createFailedAgentLabArtifact(
  request: AgentLabRunRequest,
  { runId, startedAtMs, events, message }: CreateFailedArtifactOptions,
): AgentLabFailedRunArtifactValue {
  const scenario = findAgentLabScenario(request.scenarioId);
  const completedAtMs = Date.now();
  return AgentLabFailedRunArtifact.parse({
    schemaVersion: AGENT_LAB_ARTIFACT_SCHEMA_VERSION,
    runId,
    scenarioId: request.scenarioId,
    strategyId: request.strategyId,
    dataMode: request.dataMode,
    status: "failed",
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    versions: {
      fixture: scenario.fixtureVersion,
      evaluator: "basic-plan-v1",
    },
    events,
    failure: {
      code: "run_failed",
      message,
      atSequence: events.length,
    },
    metrics: {
      eventCount: events.length,
      durationMs: completedAtMs - startedAtMs,
    },
  });
}
