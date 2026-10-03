import type { AgentLabRunEvent } from "@trip/shared";
import { stopReasonLabel } from "./comparison";

/** Which part of the system produced an event, so the inspector can tell them apart. */
export type EventKind = "run" | "graph" | "specialist" | "tool";

export const eventKindLabel: Record<EventKind, string> = {
  run: "Run",
  graph: "Graph stage",
  specialist: "Specialist",
  tool: "Tool",
};

export interface EventCopy {
  kind: EventKind;
  title: string;
  detail: string;
  /** Constraints the actor was given, when the event states them. */
  constraints?: string[];
  /** Another named list the event carries, such as the conflicts a check found. */
  list?: { heading: string; lines: string[] };
}

const agentName = (agent: string) => agent.replace(/-/g, " ");
/** A revision runs a specialist again, so later rounds say which round a title belongs to. */
const inRound = (round: number) => (round > 1 ? ` · round ${round}` : "");

const phaseTitle = {
  dispatch: "Dispatch specialists",
  conflicts: "Detect conflicts",
  revision: "Revise conflicts",
  assembly: "Assemble plan",
} as const;

export function eventCopy(runEvent: AgentLabRunEvent): EventCopy {
  const event = runEvent.event;
  switch (event.type) {
    case "lab_run_started":
      return { kind: "run", title: "Run started", detail: event.summary };
    case "lab_strategy_started":
      return {
        kind: "run",
        title: event.actor === "multi-agent" ? "Five specialists started" : "Single agent started",
        detail: event.objective,
        constraints: event.constraints,
      };
    case "lab_tool_started":
      return { kind: "tool", title: event.label, detail: event.summary };
    case "lab_tool_completed":
      return { kind: "tool", title: event.label, detail: event.resultSummary };
    case "lab_conflict_detected":
      return {
        kind: "graph",
        title: `Conflict check · round ${event.round} · ${
          event.infeasible
            ? "infeasible budget"
            : event.conflicts.length
              ? "repairable"
              : "none found"
        }`,
        detail: event.summary,
        list: event.conflicts.length
          ? {
              heading: "Conflicts",
              lines: event.conflicts.map(
                (conflict) =>
                  `${agentName(conflict.agent)}: ${conflict.reason}${
                    conflict.targetSaving !== undefined
                      ? ` (asked to save AUD ${conflict.targetSaving.toFixed(2)})`
                      : ""
                  }`,
              ),
            }
          : undefined,
      };
    case "lab_revision_started":
      return {
        kind: "graph",
        title: `Revise ${agentName(event.agent)} · round ${event.round}`,
        detail: event.objective,
        list: { heading: "Previous outcome", lines: [event.previousOutcome] },
      };
    case "lab_revision_scored":
      return {
        kind: "graph",
        title: `Revision scored · round ${event.round}`,
        detail: event.summary,
      };
    case "lab_loop_stopped":
      return {
        kind: "graph",
        title: `Loop stopped · round ${event.round} · ${stopReasonLabel(event.reason)}`,
        detail: event.summary,
      };
    case "lab_fault_injected":
      return {
        kind: "run",
        title: `Fault injected · ${event.capability}`,
        detail: event.summary,
      };
    case "lab_agent_output_rejected":
      return {
        kind: "specialist",
        title: `${agentName(event.agent)} output rejected${inRound(event.round)}`,
        detail: event.summary,
        list: { heading: "Rejected fields", lines: event.fields },
      };
    case "lab_supervisor_fallback":
      return {
        kind: "graph",
        title: `Supervisor fallback · ${event.phase}${inRound(event.round)}`,
        detail: event.summary,
      };
    case "lab_plan_validated":
      return { kind: "run", title: "Plan validated", detail: event.summary };
    case "lab_evaluation_completed":
      return { kind: "run", title: "Evaluation complete", detail: event.summary };
    case "lab_strategy_completed":
      return {
        kind: "run",
        title: event.actor === "multi-agent" ? "Specialists completed" : "Single agent completed",
        detail: event.summary,
      };
    case "lab_run_completed":
      return { kind: "run", title: "Run completed", detail: event.summary };
    case "agent_reasoning":
      return {
        kind: "specialist",
        title: `${agentName(event.agent)} reasoning`,
        detail: event.text,
      };
    case "coordinator":
      return {
        kind: "graph",
        title: phaseTitle[event.phase],
        detail: event.summary,
        constraints: event.constraints?.length ? event.constraints : undefined,
      };
    case "agent_started":
      return {
        kind: "specialist",
        title: `${agentName(event.agent)} started${inRound(event.round)}`,
        detail: event.objective ?? event.summary ?? "Started.",
        constraints: event.constraints?.length ? event.constraints : undefined,
      };
    case "agent_completed":
      return {
        kind: "specialist",
        title: `${agentName(event.agent)} completed${inRound(event.round)}`,
        detail: event.outcome ?? event.summary ?? "Completed.",
      };
    case "agent_failed":
      return {
        kind: "specialist",
        title: `${agentName(event.agent)} failed${inRound(event.round)}`,
        detail: event.error,
      };
    case "tool_started":
      return {
        kind: "tool",
        title: `${agentName(event.agent)} · ${event.label}${inRound(event.round)}`,
        detail: event.summary,
      };
    case "tool_completed":
      return {
        kind: "tool",
        title: `${agentName(event.agent)} · ${event.label}${inRound(event.round)}`,
        detail: event.resultSummary,
      };
    case "tool_failed":
      return {
        kind: "tool",
        title: `${agentName(event.agent)} · ${event.label} failed${inRound(event.round)}`,
        detail: event.error,
      };
  }
}
