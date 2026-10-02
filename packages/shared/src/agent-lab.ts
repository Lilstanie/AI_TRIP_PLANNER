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

// Who ran a strategy: the lone baseline, or the five specialists coordinated by the graph.
export const AgentLabActor = z.enum(["single-agent", "multi-agent"]);
export type AgentLabActor = z.infer<typeof AgentLabActor>;

// Why the planning loop ended; exactly one applies to every multi-agent run.
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
    // AUD over budget plus a tenth of the budget per other conflict; lower is better.
    score: z.number().nonnegative(),
    // True when no revision can meet the budget, so the loop stops instead of revising.
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
    // What the specialist proposed before this revision, so a reader can see what it replaced.
    previousOutcome: z.string().min(1),
  }),
  z.object({
    type: z.literal("lab_revision_scored"),
    round: z.number().int().positive(),
    agents: z.array(z.enum(AGENT_NAMES)),
    scoreBefore: z.number().nonnegative(),
    scoreAfter: z.number().nonnegative(),
    // False means the revision did not improve the plan and the previous proposals stand.
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

// One named, deterministic check. Showing each check, instead of a bare pass count, lets a visitor see
// exactly which constraints were measured.
export const AgentLabCheck = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  passed: z.boolean(),
});
export type AgentLabCheck = z.infer<typeof AgentLabCheck>;

export const AgentLabMetrics = z.object({
  withinBudget: z.boolean(),
  // Budget minus estimate; negative when the plan is over budget.
  budgetHeadroom: z.number(),
  sectionCount: z.number().int().nonnegative(),
  checks: z.array(AgentLabCheck).min(1),
  eventCount: z.number().int().nonnegative(),
  // Wall time including the pacing delay that makes the stream watchable.
  durationMs: z.number().int().nonnegative(),
  // Wall time without that pacing: what the strategy itself took. Fixture latency measures
  // orchestration overhead only, never model latency.
  latencyMs: z.number().int().nonnegative(),
  // Planning rounds the graph ran. One means no revision happened.
  rounds: z.number().int().positive(),
  // Tool calls that completed in the trace.
  toolCalls: z.number().int().nonnegative(),
  // Sections whose proposal came from a deterministic fallback instead of the specialist's own draft.
  fallbacks: z.number().int().nonnegative(),
  failedAgents: z.number().int().nonnegative(),
  unresolvedConflicts: z.number().int().nonnegative(),
  // Sections built from provider or fixture evidence rather than a fallback or an unavailable source.
  groundedSections: z.number().int().nonnegative(),
  // Itinerary stops that repeat an earlier stop, counting each repeat after the first visit.
  duplicateStops: z.number().int().nonnegative(),
  // Itinerary stops that name no real place ("Mock attraction near Tokyo", a bare city, nothing).
  genericStops: z.number().int().nonnegative(),
  // Whether every city of a multi-city trip has a stay and an activity; null for a single-city trip.
  multiCityConsistent: z.boolean().nullable(),
  // Why the loop ended, from the trace; null for a strategy that has no loop.
  stopReason: AgentLabStopReason.nullable(),
  // Token and model-cost usage. Fixture runs make no model calls, so this is unavailable, never zero.
  usage: z.object({ status: z.literal("unavailable"), reason: z.string().min(1) }),
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
