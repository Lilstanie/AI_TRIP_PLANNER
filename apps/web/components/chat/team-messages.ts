import type {
  AgentProgressEvent,
  AgentName,
  AssistantId,
  ChatWorkflowDecision,
} from "@trip/shared";
import { PREPARING_SUMMARY } from "@/lib/workspace/session";

import type { DecidedBy } from "./team-model";

export interface TeamMessage {
  id: string;
  assistant: AssistantId;
  round: number;
  kind: "dispatch" | "result" | "failed" | "handoff";
  handoffTo?: AgentName;
  decidedBy?: DecidedBy;
  text: string;
  objectives: { agent: AgentName; text: string }[];
  source?: Extract<AgentProgressEvent, { type: "agent_completed" }>["source"];
  toolCalls: number;
}

export interface CheckMessage {
  id: string;
  kind: "check";
  round: number;
  decision: Extract<
    ChatWorkflowDecision,
    { type: "conflicts_detected" | "revision_scored" | "loop_stopped" }
  >;
}

export type TeamEntry = TeamMessage | CheckMessage;

export function teamMessages(
  activity: readonly AgentProgressEvent[],
  settled: boolean,
): TeamEntry[] {
  const messages: TeamEntry[] = [];
  const reasoned = (assistant: AssistantId, round: number) =>
    activity.some(
      (event) =>
        event.type === "agent_reasoning" &&
        (event.assistant ?? event.agent) === assistant &&
        (assistant === "coordinator" || event.round === round),
    );
  const decidedBy = (assistant: AssistantId, round: number): DecidedBy | undefined =>
    reasoned(assistant, round) ? "llm" : settled ? "code" : undefined;
  for (const event of activity) {
    if (event.type === "coordinator" && event.summary === PREPARING_SUMMARY) continue;
    if (
      event.type === "coordinator" &&
      (event.phase === "dispatch" || event.phase === "revision")
    ) {
      messages.push({
        id: `coordinator:${event.phase}:${event.round}`,
        assistant: "coordinator",
        round: event.round,
        kind: "dispatch",
        decidedBy: decidedBy("coordinator", event.round),
        text: event.summary,
        objectives: activity.flatMap((started) =>
          started.type === "agent_started" && started.round === event.round && started.objective
            ? [{ agent: started.agent, text: started.objective }]
            : [],
        ),
        toolCalls: 0,
      });
    } else if (event.type === "decision" && event.decision.type === "mention_handoff") {
      messages.push({
        id: `handoff:${event.decision.from}:${event.decision.to}`,
        assistant: event.decision.from,
        round: event.round,
        kind: "handoff",
        handoffTo: event.decision.to,
        decidedBy: event.decision.decidedBy,
        text: "",
        objectives: [],
        toolCalls: 0,
      });
    } else if (
      event.type === "decision" &&
      (event.decision.type === "conflicts_detected" ||
        event.decision.type === "revision_scored" ||
        event.decision.type === "loop_stopped")
    ) {
      messages.push({
        id: `check:${event.decision.type}:${event.round}:${messages.length}`,
        kind: "check",
        round: event.round,
        decision: event.decision,
      });
    } else if (event.type === "agent_completed" || event.type === "agent_failed") {
      const failed = event.type === "agent_failed";
      messages.push({
        id: `${event.agent}:${event.round}:${failed ? "failed" : "result"}`,
        assistant: event.agent,
        round: event.round,
        kind: failed ? "failed" : "result",
        decidedBy: decidedBy(event.agent, event.round),
        text: failed ? event.error : (event.summary ?? event.outcome ?? ""),
        objectives: [],
        ...(!failed && event.source ? { source: event.source } : {}),
        toolCalls: activity.filter(
          (other) =>
            other.type === "tool_completed" &&
            other.agent === event.agent &&
            other.round === event.round,
        ).length,
      });
    }
  }
  return messages;
}
