import { z } from "zod";
import { AgentProgressEvent } from "./chat";
import { AGENT_NAMES } from "./contracts";
import { TripPlan } from "./plan";

export const AGENT_LAB_ARTIFACT_SCHEMA_VERSION = 1 as const;

export const AgentLabScenarioId = z.enum([
  "tokyo-couple",
  "tokyo-couple-tight-budget",
  "paris-family-infeasible",
  "tokyo-kyoto-multi-city",
]);
export type AgentLabScenarioId = z.infer<typeof AgentLabScenarioId>;

export const AgentLabStrategyId = z.enum([
  "single-agent-baseline",
  "multi-agent-no-revision",
  "multi-agent-targeted-revision",
]);
export type AgentLabStrategyId = z.infer<typeof AgentLabStrategyId>;

export const AgentLabDataMode = z.enum(["fixture", "live"]);
export type AgentLabDataMode = z.infer<typeof AgentLabDataMode>;

export const AgentLabFaultProfileId = z.enum([
  "provider-timeout",
  "provider-empty-result",
  "invalid-agent-output",
  "supervisor-failure",
  "stalled-revision",
]);
export type AgentLabFaultProfileId = z.infer<typeof AgentLabFaultProfileId>;

export const AgentLabFaultCapability = z.enum([...AGENT_NAMES, "supervisor"]);
export type AgentLabFaultCapability = z.infer<typeof AgentLabFaultCapability>;

export const AgentLabRunRequest = z
  .object({
    scenarioId: AgentLabScenarioId,
    strategyId: AgentLabStrategyId,
    dataMode: AgentLabDataMode,
    faultProfileId: AgentLabFaultProfileId.optional(),
  })
  .strict();
export type AgentLabRunRequest = z.infer<typeof AgentLabRunRequest>;

export const AgentLabActor = z.enum(["single-agent", "multi-agent"]);
export type AgentLabActor = z.infer<typeof AgentLabActor>;

export const AgentLabStopReason = z.enum([
  "converged",
  "round_limit",
  "infeasible_budget",
  "no_improvement",
]);
export type AgentLabStopReason = z.infer<typeof AgentLabStopReason>;

export const AgentLabLifecycleEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("lab_run_started"),
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_strategy_started"),
    actor: AgentLabActor,
    objective: z.string().min(1),
    constraints: z.array(z.string().min(1)),
  }),
  z.object({
    type: z.literal("lab_tool_started"),
    callId: z.string().min(1),
    tool: z.string().min(1),
    label: z.string().min(1),
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_tool_completed"),
    callId: z.string().min(1),
    tool: z.string().min(1),
    label: z.string().min(1),
    resultSummary: z.string().min(1),
    resultCount: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("lab_conflict_detected"),
    round: z.number().int().positive(),

    score: z.number().nonnegative(),

    infeasible: z.boolean(),
    conflicts: z.array(
      z.object({
        agent: z.enum(AGENT_NAMES),
        reason: z.string().min(1),
        targetSaving: z.number().nonnegative().optional(),
      }),
    ),
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_revision_started"),
    round: z.number().int().positive(),
    agent: z.enum(AGENT_NAMES),
    objective: z.string().min(1),

    previousOutcome: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_revision_scored"),
    round: z.number().int().positive(),
    agents: z.array(z.enum(AGENT_NAMES)),
    scoreBefore: z.number().nonnegative(),
    scoreAfter: z.number().nonnegative(),

    kept: z.boolean(),
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_loop_stopped"),
    round: z.number().int().positive(),
    reason: AgentLabStopReason,
    unresolved: z.number().int().nonnegative(),
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_fault_injected"),
    profileId: AgentLabFaultProfileId,
    capability: AgentLabFaultCapability,
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_agent_output_rejected"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
    fields: z.array(z.string().min(1)).min(1),
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_supervisor_fallback"),
    phase: z.enum(["dispatch", "revision"]),
    round: z.number().int().positive(),
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_plan_validated"),
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_evaluation_completed"),
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_strategy_completed"),
    actor: AgentLabActor,
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_run_completed"),
    summary: z.string().min(1),
  }),
]);
export type AgentLabLifecycleEvent = z.infer<typeof AgentLabLifecycleEvent>;

export const AgentLabEventPayload = z.union([AgentProgressEvent, AgentLabLifecycleEvent]);
export type AgentLabEventPayload = z.infer<typeof AgentLabEventPayload>;

export const AgentLabRunEvent = z.object({
  runId: z.string().min(1),
  sequence: z.number().int().positive(),
  at: z.string().min(1),
  elapsedMs: z.number().int().nonnegative(),
  scenarioId: AgentLabScenarioId,
  strategyId: AgentLabStrategyId,
  dataMode: AgentLabDataMode,
  event: AgentLabEventPayload,
});
export type AgentLabRunEvent = z.infer<typeof AgentLabRunEvent>;

export const AgentLabCheck = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  passed: z.boolean(),
});
export type AgentLabCheck = z.infer<typeof AgentLabCheck>;

export const AgentLabMetrics = z.object({
  withinBudget: z.boolean(),

  budgetHeadroom: z.number(),
  sectionCount: z.number().int().nonnegative(),
  checks: z.array(AgentLabCheck).min(1),
  eventCount: z.number().int().nonnegative(),

  durationMs: z.number().int().nonnegative(),

  latencyMs: z.number().int().nonnegative(),

  rounds: z.number().int().positive(),

  toolCalls: z.number().int().nonnegative(),

  fallbacks: z.number().int().nonnegative(),
  failedAgents: z.number().int().nonnegative(),
  unresolvedConflicts: z.number().int().nonnegative(),

  groundedSections: z.number().int().nonnegative(),

  duplicateStops: z.number().int().nonnegative(),

  genericStops: z.number().int().nonnegative(),

  multiCityConsistent: z.boolean().nullable(),

  stopReason: AgentLabStopReason.nullable(),

  usage: z.discriminatedUnion("status", [
    z.object({ status: z.literal("unavailable"), reason: z.string().min(1) }),
    z.object({
      status: z.literal("measured"),
      modelCalls: z.number().int().positive(),
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative(),
    }),
  ]),
});
export type AgentLabMetrics = z.infer<typeof AgentLabMetrics>;

export const AgentLabFailureMetrics = z.object({
  eventCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});
export type AgentLabFailureMetrics = z.infer<typeof AgentLabFailureMetrics>;

export const AgentLabFailure = z.object({
  code: z.enum(["run_failed", "agent_failed"]),
  message: z.string().min(1),
  atSequence: z.number().int().nonnegative(),
  agent: z.enum(AGENT_NAMES).optional(),
});
export type AgentLabFailure = z.infer<typeof AgentLabFailure>;

const AgentLabRunArtifactBase = z
  .object({
    schemaVersion: z.literal(AGENT_LAB_ARTIFACT_SCHEMA_VERSION),
    runId: z.string().min(1),
    scenarioId: AgentLabScenarioId,
    strategyId: AgentLabStrategyId,
    dataMode: AgentLabDataMode,

    faultProfileId: AgentLabFaultProfileId.nullable().default(null),
    startedAt: z.string().min(1),
    completedAt: z.string().min(1),
    versions: z.object({
      fixture: z.string().min(1),
      evaluator: z.string().min(1),
    }),
    events: z.array(AgentLabRunEvent),
  })
  .check((ctx) => {
    const artifact = ctx.value;
    artifact.events.forEach((event, index) => {
      if (event.sequence !== index + 1) {
        ctx.issues.push({
          code: "custom",
          input: event.sequence,
          message: "Agent Lab event sequences must be contiguous and start at 1",
          path: ["events", index, "sequence"],
        });
      }
      if (
        event.runId !== artifact.runId ||
        event.scenarioId !== artifact.scenarioId ||
        event.strategyId !== artifact.strategyId ||
        event.dataMode !== artifact.dataMode
      ) {
        ctx.issues.push({
          code: "custom",
          input: event,
          message: "Agent Lab event metadata must match its artifact",
          path: ["events", index],
        });
      }
    });
  });

export const AgentLabCompletedRunArtifact = AgentLabRunArtifactBase.safeExtend({
  status: z.literal("completed"),
  failure: z.null(),
  plan: TripPlan,
  metrics: AgentLabMetrics,
}).check((ctx) => {
  if (ctx.value.events.length === 0) {
    ctx.issues.push({
      code: "custom",
      input: ctx.value.events,
      message: "Completed Agent Lab artifacts must contain events",
      path: ["events"],
    });
  }
  if (ctx.value.metrics.eventCount !== ctx.value.events.length) {
    ctx.issues.push({
      code: "custom",
      input: ctx.value.metrics.eventCount,
      message: "Agent Lab eventCount must match the artifact event list",
      path: ["metrics", "eventCount"],
    });
  }
});
export type AgentLabCompletedRunArtifact = z.infer<typeof AgentLabCompletedRunArtifact>;

export const AgentLabFailedRunArtifact = AgentLabRunArtifactBase.safeExtend({
  status: z.literal("failed"),
  failure: AgentLabFailure,
  metrics: AgentLabFailureMetrics,
}).check((ctx) => {
  if (ctx.value.metrics.eventCount !== ctx.value.events.length) {
    ctx.issues.push({
      code: "custom",
      input: ctx.value.metrics.eventCount,
      message: "Agent Lab eventCount must match the artifact event list",
      path: ["metrics", "eventCount"],
    });
  }
  if (ctx.value.failure.atSequence !== ctx.value.events.length) {
    ctx.issues.push({
      code: "custom",
      input: ctx.value.failure.atSequence,
      message: "Agent Lab failure sequence must match the last recorded event",
      path: ["failure", "atSequence"],
    });
  }
});
export type AgentLabFailedRunArtifact = z.infer<typeof AgentLabFailedRunArtifact>;

export const AgentLabRunArtifact = z.discriminatedUnion("status", [
  AgentLabCompletedRunArtifact,
  AgentLabFailedRunArtifact,
]);
export type AgentLabRunArtifact = z.infer<typeof AgentLabRunArtifact>;

export const AgentLabRejectionReason = z.enum([
  "live_disabled",
  "live_unsupported",
  "concurrency_limit",
  "rate_limit",
]);
export type AgentLabRejectionReason = z.infer<typeof AgentLabRejectionReason>;

export const AgentLabStreamFrame = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rejected"),
    reason: AgentLabRejectionReason,
    message: z.string().min(1),
    retryAfterSeconds: z.number().int().nonnegative().optional(),
  }),
  z.object({ type: z.literal("event"), event: AgentLabRunEvent }),
  z.object({ type: z.literal("complete"), artifact: AgentLabCompletedRunArtifact }),
  z.object({
    type: z.literal("error"),
    error: z.string().min(1),
    artifact: AgentLabFailedRunArtifact,
  }),
]);
export type AgentLabStreamFrame = z.infer<typeof AgentLabStreamFrame>;
