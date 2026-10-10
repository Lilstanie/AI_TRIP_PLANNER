"use client";
import type { AgentProgressEvent } from "@trip/shared";
import { ThinkingOrb } from "thinking-orbs";
import type { SubagentModel } from "./thinking-model";

type OrbState =
  "working" | "searching" | "solving" | "connecting" | "weaving" | "composing" | "breathing";

export function orbState(activity: AgentProgressEvent[]): OrbState {
  const last = [...activity].reverse().find((event) => event.type !== "agent_completed");
  if (!last) return "breathing";
  switch (last.type) {
    case "coordinator":
      return last.phase === "dispatch"
        ? "weaving"
        : last.phase === "conflicts"
          ? "solving"
          : last.phase === "revision"
            ? "working"
            : "composing";
    case "tool_started":
    case "tool_completed":
      return "searching";
    case "agent_started":
      return "connecting";
    default:
      return "breathing";
  }
}

export function ThinkingOrbIcon({ activity }: { activity: AgentProgressEvent[] }) {
  return (
    <ThinkingOrb
      className="thinking-orb"
      state={orbState(activity)}
      size={20}
      theme="auto"
      aria-hidden="true"
    />
  );
}

export function subagentOrbState(model: SubagentModel): OrbState {
  if (model.status === "revising") return "working";
  const last = model.steps.at(-1);
  if (!last) return "connecting";
  if (last.kind === "reasoning") return "breathing";
  if (last.row.state !== "running") return "composing";
  return /route/i.test(last.row.started.tool) ? "connecting" : "searching";
}

export function SubagentOrbIcon({ model }: { model: SubagentModel }) {
  return (
    <ThinkingOrb
      className="thinking-orb"
      state={subagentOrbState(model)}
      size={20}
      theme="auto"
      aria-hidden="true"
    />
  );
}
