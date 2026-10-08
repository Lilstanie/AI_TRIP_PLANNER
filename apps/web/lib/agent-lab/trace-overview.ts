import type { AgentLabRunEvent } from "@trip/shared";
import { eventCopy, type EventKind } from "./event-copy";

/**
 * The Trace view's overview model, derived only from the recorded events (never from a second source),
 * so the bar cannot disagree with the artifact. The axis is steps, not time: each record takes one
 * slot, because every envelope's elapsedMs includes the stream's pacing delay.
 */

/** Lanes in display order. Empty lanes are omitted from the model. */
export const TRACE_LANES = [
  { id: "run", label: "Run", short: "Run" },
  { id: "coordinator", label: "Coordinator", short: "Coord" },
  { id: "transport", label: "transport", short: "Trans" },
  { id: "destination-guide", label: "destination guide", short: "Guide" },
  { id: "accommodation", label: "accommodation", short: "Stay" },
  { id: "itinerary", label: "itinerary", short: "Itin" },
  { id: "dining", label: "dining", short: "Dine" },
  { id: "baseline", label: "Baseline", short: "Base" },
] as const;

export type TraceLaneId = (typeof TRACE_LANES)[number]["id"];

export interface TraceRecord {
  /** 1-based slot on the step axis. */
  step: number;
  lane: TraceLaneId;
  kind: EventKind;
  title: string;
  /** The round the record belongs to, where its event states one. */
  round?: number;
  error: boolean;
  /** A tool call that started and has no completion or failure yet: a start marker, not a span. */
  inFlight: boolean;
  /** Sequence of the list row this record maps to (the start row for a merged tool call). */
  sequence: number;
}

export interface TraceLane {
  id: TraceLaneId;
  label: string;
  short: string;
  records: TraceRecord[];
}

export interface TraceOverview {
  lanes: TraceLane[];
  /** Every record in step order. */
  records: TraceRecord[];
  /** Steps that open a round after the first, with the round number. */
  boundaries: { step: number; round: number }[];
}

/** The lane an event is drawn in. */
function laneOf(runEvent: AgentLabRunEvent): TraceLaneId {
  const event = runEvent.event;
  switch (event.type) {
    case "lab_run_started":
    case "lab_fault_injected":
    case "lab_plan_validated":
    case "lab_evaluation_completed":
    case "lab_run_completed":
      return "run";
    case "lab_strategy_started":
    case "lab_strategy_completed":
      return event.actor === "single-agent" ? "baseline" : "coordinator";
    case "lab_tool_started":
    case "lab_tool_completed":
      return "baseline";
    case "lab_conflict_detected":
    case "lab_revision_started":
    case "lab_revision_scored":
    case "lab_loop_stopped":
    case "lab_supervisor_fallback":
    case "coordinator":
      return "coordinator";
    case "lab_agent_output_rejected":
    case "agent_reasoning":
    case "agent_started":
    case "agent_completed":
    case "agent_failed":
    case "tool_started":
    case "tool_completed":
    case "tool_failed":
      return event.agent;
  }
}

function roundOf(runEvent: AgentLabRunEvent): number | undefined {
  const event = runEvent.event;
  return "round" in event ? event.round : undefined;
}

const isError = (runEvent: AgentLabRunEvent) =>
  runEvent.event.type === "tool_failed" ||
  runEvent.event.type === "agent_failed" ||
  runEvent.event.type === "lab_agent_output_rejected";

export function deriveTraceOverview(events: readonly AgentLabRunEvent[]): TraceOverview {
  const records: TraceRecord[] = [];
  // Open tool calls by call id, oldest first: a call id can repeat (the targeted revision starts the same
  // call twice), and each completion or failure folds into the earliest start still open.
  const open = new Map<string, TraceRecord[]>();

  for (const runEvent of events) {
    const event = runEvent.event;
    const copy = eventCopy(runEvent);
    if (
      event.type === "tool_completed" ||
      event.type === "tool_failed" ||
      event.type === "lab_tool_completed"
    ) {
      const start = open.get(event.callId)?.shift();
      if (start) {
        start.inFlight = false;
        start.title = copy.title;
        start.error = isError(runEvent);
        continue;
      }
    }
    const record: TraceRecord = {
      step: records.length + 1,
      lane: laneOf(runEvent),
      kind: copy.kind,
      title: copy.title,
      round: roundOf(runEvent),
      error: isError(runEvent),
      inFlight: event.type === "tool_started" || event.type === "lab_tool_started",
      sequence: runEvent.sequence,
    };
    if (record.inFlight) {
      const callId = (event as { callId: string }).callId;
      open.set(callId, [...(open.get(callId) ?? []), record]);
    }
    records.push(record);
  }

  const boundaries: TraceOverview["boundaries"] = [];
  let reached = 1;
  for (const record of records) {
    if (record.round !== undefined && record.round > reached) {
      reached = record.round;
      boundaries.push({ step: record.step, round: record.round });
    }
  }

  const lanes = TRACE_LANES.map((lane) => ({
    id: lane.id,
    label: lane.label,
    short: lane.short,
    records: records.filter((record) => record.lane === lane.id),
  })).filter((lane) => lane.records.length > 0);

  return { lanes, records, boundaries };
}
