"use client";
import type { AgentProgressEvent } from "@trip/shared";
import { ThinkingOrb } from "thinking-orbs";
import type { SubagentModel } from "./thinking-model";

type OrbState = "working" | "searching" | "solving" | "connecting" | "weaving" | "composing" | "breathing";

/**
 * What the orb shows, read from the latest real progress event — never from elapsed time:
 * planning is weaving, a provider lookup is searching, checking the plan is solving, a revision is
 * working, assembling is composing, and a specialist's own reasoning is breathing.
 */
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

/**
 * The Think row's icon while a request runs. The row's own text says what is happening, so the
 * orb is hidden from assistive technology; under reduced motion the package draws one still frame.
 */
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

/**
 * One running specialist's orb, from its own latest step: a route check connects places, any other
 * provider call searches, a revision works, and its reasoning breathes. Starting up, before any
 * step, it connects to its sources.
 */
export function subagentOrbState(model: SubagentModel): OrbState {
  if (model.status === "revising") return "working";
  const last = model.steps.at(-1);
  if (!last) return "connecting";
  if (last.kind === "reasoning") return "breathing";
  if (last.row.state !== "running") return "composing";
  return /route/i.test(last.row.started.tool) ? "connecting" : "searching";
}

/** The icon of a running Subagent row; one orb per active step, as the package recommends. */
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
