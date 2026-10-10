import type { AgentName } from "@trip/shared";

export type StopReason = "converged" | "round_limit" | "infeasible_budget" | "no_improvement";

export type WorkflowDecision =
  | {
      type: "conflicts_detected";
      round: number;

      score: number;

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

      kept: boolean;
    }
  | { type: "loop_stopped"; round: number; reason: StopReason; unresolved: number }
  | {
      type: "agent_output_rejected";
      agent: AgentName;
      round: number;
      fields: string[];
    }
  | {
      type: "delegation_fallback";
      phase: "dispatch" | "revision";
      round: number;
    };
