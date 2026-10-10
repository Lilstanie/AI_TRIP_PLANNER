import {
  AGENT_LAB_ARTIFACT_SCHEMA_VERSION,
  AgentLabCompletedRunArtifact,
  AgentLabFailedRunArtifact,
  AgentLabRunEvent,
  type AgentLabEventPayload,
  type AgentLabFailedRunArtifact as AgentLabFailedRunArtifactValue,
  type AgentLabRunArtifact as AgentLabRunArtifactValue,
  type AgentLabRunEvent as AgentLabRunEventValue,
  type AgentLabRunRequest,
} from "@trip/shared";
import {
  createUsageCollector,
  runWithModelsDisabled,
  runWithUsageCollector,
  type UsageCollector,
} from "@trip/agents";
import { runWithDataMode } from "@trip/tools";
import { AGENT_LAB_EVALUATOR_VERSION, evaluateAgentLabPlan } from "./evaluate";
import { findAgentLabFaultProfile, isRegisteredAgentLabRun } from "./fault-profiles";
import { measureAgentLabRun } from "./metrics";
import { findAgentLabScenario } from "./scenarios";
import { findAgentLabStrategy } from "./strategies";
import { buildAgentLabUsage } from "./usage";

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
  if (request.dataMode === "live") {
    if (!findAgentLabStrategy(request.strategyId).live) {
      throw new Error("This strategy has no live implementation.");
    }
    const usage = createUsageCollector();
    return runWithDataMode("live", () =>
      runWithUsageCollector(usage, () => executeAgentLab(request, options, usage)),
    );
  }
  return runWithDataMode("mock", () =>
    runWithModelsDisabled(() => executeAgentLab(request, options)),
  );
}

async function executeAgentLab(
  request: AgentLabRunRequest,
  options: RunAgentLabOptions,
  usage?: UsageCollector,
): Promise<AgentLabCompletedRunArtifact> {
  const fallbackController = new AbortController();
  const signal = options.signal ?? fallbackController.signal;
  if (!isRegisteredAgentLabRun(request)) {
    throw new Error("This Agent Lab run is not registered.");
  }
  const fault = request.faultProfileId
    ? findAgentLabFaultProfile(request.faultProfileId)
    : undefined;
  const scenario = findAgentLabScenario(request.scenarioId);
  const strategy = findAgentLabStrategy(request.strategyId);
  const runId = options.runId ?? `agent-lab-${crypto.randomUUID()}`;
  const startedAtMs = options.startedAtMs ?? Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const events: AgentLabRunEventValue[] = [];

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
  if (fault) {
    await emit({
      type: "lab_fault_injected",
      profileId: fault.id,
      capability: fault.capability,
      summary: fault.summary,
    });
  }
  const plan = await strategy.run({ scenario, signal, emit, fault });
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
    faultProfileId: request.faultProfileId ?? null,
    status: "completed",
    failure: null,
    startedAt,
    completedAt: new Date(completedAtMs).toISOString(),
    versions: {
      fixture: scenario.fixtureVersion,
      evaluator: AGENT_LAB_EVALUATOR_VERSION,
    },
    events,
    plan,
    metrics: {
      ...measureAgentLabRun(scenario, plan, events),

      ...(usage ? { usage: buildAgentLabUsage(usage.snapshot()) } : {}),
      durationMs: completedAtMs - startedAtMs,
      latencyMs: Math.max(0, completedAtMs - startedAtMs - pacedMs),
    },
  });
}

function failureOf(events: AgentLabRunEventValue[], message: string) {
  const failed = [...events].reverse().find((entry) => entry.event.type === "agent_failed");
  if (failed?.event.type !== "agent_failed") return { code: "run_failed" as const, message };
  return {
    code: "agent_failed" as const,
    agent: failed.event.agent,
    message: `The ${failed.event.agent} specialist could not finish, so no plan was assembled.`,
  };
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
    faultProfileId: request.faultProfileId ?? null,
    status: "failed",
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    versions: {
      fixture: scenario.fixtureVersion,
      evaluator: AGENT_LAB_EVALUATOR_VERSION,
    },
    events,
    failure: {
      ...failureOf(events, message),
      atSequence: events.length,
    },
    metrics: {
      eventCount: events.length,
      durationMs: completedAtMs - startedAtMs,
    },
  });
}

export async function runAgentLabToArtifact(
  request: AgentLabRunRequest,
  options: RunAgentLabOptions = {},
): Promise<AgentLabRunArtifactValue> {
  const runId = options.runId ?? `agent-lab-${crypto.randomUUID()}`;
  const startedAtMs = options.startedAtMs ?? Date.now();
  const events: AgentLabRunEventValue[] = [];
  try {
    return await runAgentLab(request, {
      ...options,
      runId,
      startedAtMs,
      onEvent: async (event) => {
        events.push(event);
        await options.onEvent?.(event);
      },
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    console.error("[agent-lab] run failed:", error instanceof Error ? error.message : error);
    return createFailedAgentLabArtifact(request, {
      runId,
      startedAtMs,
      events,
      message: "Unable to run this Agent Lab experiment.",
    });
  }
}
