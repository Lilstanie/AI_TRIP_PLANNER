import type {
  AgentProgressEvent,
  AgentName,
  AssistantId,
  ChatWorkflowDecision,
} from "@trip/shared";
import type { MessageKey } from "@/lib/i18n/locale";
import type { Message } from "@/lib/workspace";
import { PREPARING_SUMMARY } from "@/lib/workspace/session";
import { ASSISTANT_ORDER } from "./assistant-names";

export type DecidedBy = "llm" | "code";

export type RowStatus = "idle" | "working" | "done" | "failed" | "needs_change" | "none";

export type AssignmentStatus = "working" | "done" | "failed" | "stopped";

export type AssignmentSource = Extract<AgentProgressEvent, { type: "agent_completed" }>["source"];

export interface TeamRow {
  assistant: AssistantId;
  status: RowStatus;
  objective: string | undefined;
  decidedBy: DecidedBy | undefined;
}

export interface Assignment {
  id: string;
  type: "assignment";
  owner: AssistantId;
  kind: "dispatch" | "revision" | "handoff";
  round: number;
  status: AssignmentStatus;
  objective: string | undefined;
  handoffTo: AgentName | undefined;
  decidedBy: DecidedBy | undefined;
  source: AssignmentSource;
  error: string | undefined;
}

export interface TeamCheck {
  id: string;
  type: "check";
  round: number;
  decision: Extract<
    ChatWorkflowDecision,
    { type: "conflicts_detected" | "revision_scored" | "loop_stopped" }
  >;
}

export type TeamEntry = Assignment | TeamCheck;

export interface TeamModel {
  rows: TeamRow[];
  entries: TeamEntry[];
  working: number;
}

export const sourceLabels: Record<NonNullable<AssignmentSource>, MessageKey> = {
  live: "Live data",
  estimated: "Estimated data",
  mock: "Mock data",
  fallback: "Fallback data",
  unavailable: "Unavailable data",
};

export const rowStatusLabels: Record<RowStatus, MessageKey> = {
  idle: "Idle",
  working: "Working",
  done: "Done",
  failed: "Failed",
  needs_change: "Needs change",
  none: "Not involved",
};

export const assignmentStatusLabels: Record<AssignmentStatus, MessageKey> = {
  working: "Working",
  done: "Done",
  failed: "Failed",
  stopped: "Stopped",
};

export function teamModel(activity: readonly AgentProgressEvent[], settled: boolean): TeamModel {
  const events = activity.filter(
    (event) => !(event.type === "coordinator" && event.summary === PREPARING_SUMMARY),
  );
  const reasoned = (assistant: AssistantId, round?: number) =>
    events.some(
      (event) =>
        event.type === "agent_reasoning" &&
        (event.assistant ?? event.agent) === assistant &&
        (round === undefined || event.round === round),
    );
  const decidedBy = (assistant: AssistantId, round?: number): DecidedBy | undefined =>
    reasoned(assistant, round) ? "llm" : settled ? "code" : undefined;

  const status = new Map<AssistantId, RowStatus>();
  const objective = new Map<AssistantId, string>();
  const involved = new Set<AssistantId>();
  const entries: TeamEntry[] = [];
  const open = new Map<string, Assignment>();
  const starts = new Map<AgentName, number>();
  const revisionRounds = new Set(
    events.flatMap((event) =>
      (event.type === "coordinator" && event.phase === "revision") ||
      (event.type === "decision" && event.decision.type === "revision_started")
        ? [event.round]
        : [],
    ),
  );

  for (const event of events) {
    if (event.type === "coordinator") {
      if (event.summary) objective.set("coordinator", event.summary);
    } else if (event.type === "agent_started") {
      involved.add(event.agent);
      status.set(event.agent, "working");
      if (event.objective) objective.set(event.agent, event.objective);
      const earlier = starts.get(event.agent) ?? 0;
      starts.set(event.agent, earlier + 1);
      const assignment: Assignment = {
        id: `${event.agent}:${event.round}:${earlier}`,
        type: "assignment",
        owner: event.agent,
        kind: earlier > 0 || revisionRounds.has(event.round) ? "revision" : "dispatch",
        round: event.round,
        status: "working",
        objective: event.objective,
        handoffTo: undefined,
        decidedBy: decidedBy(event.agent, event.round),
        source: undefined,
        error: undefined,
      };
      open.set(`${event.agent}:${event.round}`, assignment);
      entries.push(assignment);
    } else if (event.type === "agent_completed" || event.type === "agent_failed") {
      involved.add(event.agent);
      const failed = event.type === "agent_failed";
      status.set(event.agent, failed ? "failed" : "done");
      const assignment = open.get(`${event.agent}:${event.round}`);
      if (assignment) {
        assignment.status = failed ? "failed" : "done";
        if (failed) assignment.error = event.error;
        else assignment.source = event.source;
      }
    } else if (event.type === "decision") {
      const { decision } = event;
      if (decision.type === "mention_handoff") {
        involved.add(decision.from);
        entries.push({
          id: `handoff:${decision.from}:${decision.to}`,
          type: "assignment",
          owner: decision.from,
          kind: "handoff",
          round: event.round,
          status: "done",
          objective: undefined,
          handoffTo: decision.to,
          decidedBy: decision.decidedBy,
          source: undefined,
          error: undefined,
        });
        if (!status.has(decision.from)) status.set(decision.from, "done");
      } else if (decision.type === "conflicts_detected") {
        for (const conflict of decision.conflicts) status.set(conflict.agent, "needs_change");
        entries.push({
          id: `check:${decision.type}:${event.round}:${entries.length}`,
          type: "check",
          round: event.round,
          decision,
        });
      } else if (decision.type === "revision_scored" || decision.type === "loop_stopped") {
        entries.push({
          id: `check:${decision.type}:${event.round}:${entries.length}`,
          type: "check",
          round: event.round,
          decision,
        });
      }
    }
  }

  if (settled)
    for (const assignment of open.values())
      if (assignment.status === "working") assignment.status = "stopped";

  const lead = decidedBy("coordinator");
  const rows: TeamRow[] = ASSISTANT_ORDER.map((assistant) => {
    let value: RowStatus;
    if (assistant === "coordinator")
      value = !settled ? "working" : events.length > 0 ? "done" : "idle";
    else if (events.length === 0) value = "idle";
    else if (!involved.has(assistant)) value = settled ? "none" : "idle";
    else value = status.get(assistant) ?? "idle";
    if (settled && value === "working") value = "idle";
    return {
      assistant,
      status: value,
      objective: objective.get(assistant),
      decidedBy: assistant === "coordinator" && events.length > 0 ? lead : undefined,
    };
  });
  return {
    rows,
    entries,
    working: rows.filter((row) => row.status === "working").length,
  };
}

export interface TeamSummary {
  assistants: AssistantId[];
  specialists: AssistantId[];
  rounds: number;
}

export function teamSummary(activity: readonly AgentProgressEvent[]): TeamSummary | undefined {
  const { entries } = teamModel(activity, true);
  const specialists: AssistantId[] = [];
  const rounds = new Set<number>();
  for (const entry of entries) {
    if (entry.type !== "assignment" || entry.owner === "coordinator") continue;
    if (!specialists.includes(entry.owner)) specialists.push(entry.owner);
    if (entry.kind !== "handoff") rounds.add(entry.round);
  }
  if (specialists.length === 0) return undefined;
  return {
    assistants: specialists.length === 1 ? specialists : ["coordinator", ...specialists],
    specialists,
    rounds: Math.max(1, rounds.size),
  };
}

export function latestTurn(
  live: readonly AgentProgressEvent[],
  busy: boolean,
  messages: readonly Message[],
): readonly AgentProgressEvent[] {
  if (busy || live.length > 0) return live;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "agent" && message.activity && message.activity.length > 0)
      return message.activity;
  }
  return live;
}
