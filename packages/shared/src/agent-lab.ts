import { z } from "zod";
import { AgentProgressEvent } from "./chat";
import { TripPlan } from "./plan";

export const AGENT_LAB_ARTIFACT_SCHEMA_VERSION = 1 as const;

export const AgentLabScenarioId = z.enum(["tokyo-couple"]);
export type AgentLabScenarioId = z.infer<typeof AgentLabScenarioId>;

export const AgentLabStrategyId = z.enum(["single-agent-baseline"]);
export type AgentLabStrategyId = z.infer<typeof AgentLabStrategyId>;

export const AgentLabDataMode = z.enum(["fixture"]);
export type AgentLabDataMode = z.infer<typeof AgentLabDataMode>;

export const AgentLabRunRequest = z
  .object({
    scenarioId: AgentLabScenarioId,
    strategyId: AgentLabStrategyId,
    dataMode: AgentLabDataMode,
  })
  .strict();
export type AgentLabRunRequest = z.infer<typeof AgentLabRunRequest>;

export const AgentLabLifecycleEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("lab_run_started"),
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_strategy_started"),
    actor: z.literal("single-agent"),
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
    type: z.literal("lab_plan_validated"),
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_evaluation_completed"),
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_strategy_completed"),
    actor: z.literal("single-agent"),
    summary: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_run_completed"),
    summary: z.string().min(1),
  }),
]);
export type AgentLabLifecycleEvent = z.infer<typeof AgentLabLifecycleEvent>;

// Multi-agent strategies will wrap the orchestrator's existing progress events. The lab-specific
// lifecycle events cover run-level facts without pretending the baseline is a sixth specialist.
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

export const AgentLabMetrics = z.object({
  withinBudget: z.boolean(),
  budgetHeadroom: z.number(),
  sectionCount: z.number().int().nonnegative(),
  constraintsSatisfied: z.number().int().nonnegative(),
  constraintsTotal: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});
export type AgentLabMetrics = z.infer<typeof AgentLabMetrics>;

export const AgentLabFailureMetrics = z.object({
  eventCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});
export type AgentLabFailureMetrics = z.infer<typeof AgentLabFailureMetrics>;

export const AgentLabFailure = z.object({
  code: z.literal("run_failed"),
  message: z.string().min(1),
  atSequence: z.number().int().nonnegative(),
});
export type AgentLabFailure = z.infer<typeof AgentLabFailure>;

const AgentLabRunArtifactBase = z
  .object({
    schemaVersion: z.literal(AGENT_LAB_ARTIFACT_SCHEMA_VERSION),
    runId: z.string().min(1),
    scenarioId: AgentLabScenarioId,
    strategyId: AgentLabStrategyId,
    dataMode: AgentLabDataMode,
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

export const AgentLabStreamFrame = z.discriminatedUnion("type", [
  z.object({ type: z.literal("event"), event: AgentLabRunEvent }),
  z.object({ type: z.literal("complete"), artifact: AgentLabCompletedRunArtifact }),
  z.object({
    type: z.literal("error"),
    error: z.string().min(1),
    artifact: AgentLabFailedRunArtifact,
  }),
]);
export type AgentLabStreamFrame = z.infer<typeof AgentLabStreamFrame>;
