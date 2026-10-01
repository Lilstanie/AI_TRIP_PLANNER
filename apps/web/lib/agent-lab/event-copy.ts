import type { AgentLabRunEvent } from "@trip/shared";

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
}

const agentName = (agent: string) => agent.replace(/-/g, " ");

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
        title: `${agentName(event.agent)} started`,
        detail: event.objective ?? event.summary ?? "Started.",
        constraints: event.constraints?.length ? event.constraints : undefined,
      };
    case "agent_completed":
      return {
        kind: "specialist",
        title: `${agentName(event.agent)} completed`,
        detail: event.outcome ?? event.summary ?? "Completed.",
      };
    case "agent_failed":
      return { kind: "specialist", title: `${agentName(event.agent)} failed`, detail: event.error };
    case "tool_started":
      return {
        kind: "tool",
        title: `${agentName(event.agent)} · ${event.label}`,
        detail: event.summary,
      };
    case "tool_completed":
      return {
        kind: "tool",
        title: `${agentName(event.agent)} · ${event.label}`,
        detail: event.resultSummary,
      };
    case "tool_failed":
      return {
        kind: "tool",
        title: `${agentName(event.agent)} · ${event.label}`,
        detail: event.error,
      };
  }
}
