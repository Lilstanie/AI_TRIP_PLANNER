import type { AgentName } from "@trip/shared";

/** Why the planning loop ended. Exactly one applies to every run. */
export type StopReason = "converged" | "round_limit" | "infeasible_budget" | "no_improvement";

/**
 * The loop's decisions as typed facts. Progress events describe a run for a reader; these let a
 * consumer, such as Agent Lab, report the same decisions without parsing prose.
 */
export type WorkflowDecision =
  | {
      type: "conflicts_detected";
      round: number;
      /** `planScore` of the proposals on the table: AUD over budget plus a tenth of it per other conflict. */
      score: number;
      /** True when no revision can meet the budget, so the loop will stop instead of revising. */
      infeasible: boolean;
      conflicts: { agent: AgentName; reason: string; targetSaving?: number }[];
    }
  | {
      type: "revision_started";
      round: number;
      agent: AgentName;
      reason: string;
      objective: string;
      previousSummary: string;
      previousCost: number;
    }
  | {
      type: "revision_scored";
      round: number;
      agents: AgentName[];
      scoreBefore: number;
      scoreAfter: number;
      /** False means the revision did not improve the plan and the previous proposals stand. */
      kept: boolean;
    }
  | { type: "loop_stopped"; round: number; reason: StopReason; unresolved: number }
  | {
      /** A specialist's output failed the proposal schema. Only field paths are reported, never values. */
      type: "agent_output_rejected";
      agent: AgentName;
      round: number;
      fields: string[];
    }
  | {
      /** The supervisor could not delegate, so the workflow dispatched or revised deterministically. */
      type: "delegation_fallback";
      phase: "dispatch" | "revision";
      round: number;
    };
