"use client";
import type { AgentProgressEvent } from "@trip/shared";
import { ThinkingOrb } from "thinking-orbs";

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
