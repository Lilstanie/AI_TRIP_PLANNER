import type {
  AgentProgressEvent,
  AgentName,
  AssistantId,
  ChatWorkflowDecision,
} from "@trip/shared";
import type { MessageKey } from "@/lib/i18n/locale";
import { PREPARING_SUMMARY } from "@/lib/workspace/session";

export type DecidedBy = "llm" | "code";

export interface TeamMessage {
  id: string;
  assistant: AssistantId;
  round: number;
  kind: "dispatch" | "result" | "failed";
  decidedBy: DecidedBy;
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

export const sourceLabels: Record<NonNullable<TeamMessage["source"]>, MessageKey> = {
  live: "Live data",
  estimated: "Estimated data",
  mock: "Mock data",
  fallback: "Fallback data",
  unavailable: "Unavailable data",
};

export function teamMessages(activity: readonly AgentProgressEvent[]): TeamEntry[] {
  const messages: TeamEntry[] = [];
  const reasoned = (assistant: AssistantId, round: number) =>
    activity.some(
      (event) =>
        event.type === "agent_reasoning" &&
        (event.assistant ?? event.agent) === assistant &&
        (assistant === "coordinator" || event.round === round),
    );
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
        decidedBy: reasoned("coordinator", event.round) ? "llm" : "code",
        text: event.summary,
        objectives: activity.flatMap((started) =>
          started.type === "agent_started" && started.round === event.round && started.objective
            ? [{ agent: started.agent, text: started.objective }]
            : [],
        ),
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
        decidedBy: reasoned(event.agent, event.round) ? "llm" : "code",
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
