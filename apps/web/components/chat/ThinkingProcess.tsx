"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AGENT_NAMES, type AgentName, type AgentProgressEvent } from "@trip/shared";
import { ChevronIcon, CollapseAllIcon, ExpandAllIcon, ThinkIcon } from "../ui/icons";
import { ReasoningRow, RoundHeading, RunningLine, SubagentRow } from "./ThinkingRows";

// ---------------------------------------------------------------------------
// The thinking transcript is a flat list of DSH-style disclosure rows: one
// Think row for the turn, one row per subagent, one row per tool call, and one
// row per streamed reasoning block. This file owns the model derived from
// `activity` and the turn-level fold; ThinkingRows owns the rows themselves.
// ---------------------------------------------------------------------------

export type ActivityStatus =
  | "queued"
  | "running"
  | "revising"
  | "completed"
  | "failed"
  | "interrupted"
  | "unknown";

export const labels: Record<AgentName, string> = {
  itinerary: "Day plan",
  transport: "Getting around",
  accommodation: "Stay",
  "destination-guide": "Destination guide",
  dining: "Food & dining",
};

export const statusLabels: Record<ActivityStatus, string> = {
  queued: "Waiting",
  running: "Thinking",
  revising: "Revising",
  completed: "Complete",
  failed: "Needs attention",
  interrupted: "Interrupted",
  unknown: "Waiting for update",
};

/** Tool row states, kept to DSH's running/ok/error vocabulary. */
type ToolState = "running" | "completed" | "failed";
/** StateDot visuals: running/queued/completed plus the error colour for failures. */
export type DotState = "running" | "completed" | "failed" | "queued";

type ToolProgressEvent = Extract<
  AgentProgressEvent,
  { type: "tool_started" | "tool_completed" | "tool_failed" }
>;
type AgentLifecycleEvent = Extract<
  AgentProgressEvent,
  { type: "agent_started" | "agent_completed" | "agent_failed" }
>;
type CoordinatorEvent = Extract<AgentProgressEvent, { type: "coordinator" }>;
export type ReasoningEvent = Extract<AgentProgressEvent, { type: "agent_reasoning" }>;
type StartedEvent = Extract<AgentProgressEvent, { type: "tool_started" }>;

export const CLOCK_DELAY_MS = 15_000;

function isToolEvent(event: AgentProgressEvent): event is ToolProgressEvent {
  return (
    event.type === "tool_started" || event.type === "tool_completed" || event.type === "tool_failed"
  );
}

function isLifecycle(event: AgentProgressEvent): event is AgentLifecycleEvent {
  return (
    event.type === "agent_started" ||
    event.type === "agent_completed" ||
    event.type === "agent_failed"
  );
}

/** The last tool event of any kind, so a settled call wins over its own start. */
function latestToolEvent(events: AgentProgressEvent[]): ToolProgressEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (isToolEvent(event)) return event;
  }
  return undefined;
}

function latestLifecycle(events: AgentProgressEvent[]): AgentLifecycleEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (isLifecycle(event)) return event;
  }
  return undefined;
}

function dotState(status: ActivityStatus): DotState {
  if (status === "failed") return "failed";
  if (status === "completed") return "completed";
  if (status === "running" || status === "revising") return "running";
  return "queued";
}

function agentStatus(events: AgentProgressEvent[], busy: boolean): ActivityStatus {
  const event = latestLifecycle(events);
  if (!event) return events.length > 0 ? "unknown" : busy ? "queued" : "interrupted";
  if (event.type === "agent_failed") return "failed";
  if (event.type === "agent_completed") return "completed";
  return event.round > 1 ? "revising" : "running";
}

function failText(error: unknown): string {
  return typeof error === "string" && error.trim() ? error : "Run failed.";
}

function eventSummary(events: AgentProgressEvent[], status: ActivityStatus): string {
  const latest = latestLifecycle(events);
  const latestTool = latestToolEvent(events);
  if (status === "failed" && latest?.type === "agent_failed") return failText(latest.error);
  if (status === "running" || status === "revising") {
    if (latestTool?.type === "tool_started") return latestTool.summary;
    if (latestTool?.type === "tool_completed") return latestTool.resultSummary;
    if (latestTool?.type === "tool_failed") return failText(latestTool.error);
    if (latest?.type === "agent_started" && latest.summary) return latest.summary;
    return statusLabels[status];
  }
  if (status === "completed" && latest?.type === "agent_completed" && latest.summary) {
    return latest.summary;
  }
  if (latest?.type === "agent_started" && latest.summary) return latest.summary;
  return statusLabels[status];
}

interface Counts {
  toolCalls: number;
  subagents: number;
  rounds: number;
}

function countActivity(activity: AgentProgressEvent[]): Counts {
  const calls = new Set<string>();
  const subagents = new Set<AgentName>();
  const rounds = new Set<number>();
  for (const event of activity) {
    if (isToolEvent(event)) calls.add(event.callId);
    if (!isLifecycle(event)) continue;
    subagents.add(event.agent);
    rounds.add(event.round);
  }
  return { toolCalls: calls.size, subagents: subagents.size, rounds: rounds.size };
}

/** `N tool calls · M subagents · K rounds`, omitting parts with nothing to count. */
function countLine(counts: Counts): string {
  const parts: string[] = [];
  if (counts.toolCalls > 0) parts.push(`${counts.toolCalls} tool ${counts.toolCalls === 1 ? "call" : "calls"}`);
  if (counts.subagents > 0) parts.push(`${counts.subagents} ${counts.subagents === 1 ? "subagent" : "subagents"}`);
  if (counts.rounds > 1) parts.push(`${counts.rounds} rounds`);
  return parts.join(" · ");
}

function activeAgent(activity: AgentProgressEvent[]): AgentName | undefined {
  for (let index = activity.length - 1; index >= 0; index -= 1) {
    const event = activity[index];
    if (event.type !== "agent_started") continue;
    const settled = activity.some(
      (candidate) =>
        candidate.type === "agent_completed" &&
        candidate.agent === event.agent &&
        candidate.round === event.round,
    );
    if (!settled) return event.agent;
  }
  return undefined;
}

function runningCount(activity: AgentProgressEvent[]): number {
  const open = new Map<AgentName, boolean>();
  for (const event of activity) {
    if (event.type === "agent_started") open.set(event.agent, true);
    if (event.type === "agent_completed" || event.type === "agent_failed") open.set(event.agent, false);
  }
  let count = 0;
  for (const running of open.values()) if (running) count += 1;
  return count;
}

function activeTool(activity: AgentProgressEvent[]): ToolProgressEvent | undefined {
  const state = new Map<string, ToolProgressEvent>();
  for (const event of activity) if (isToolEvent(event)) state.set(event.callId, event);
  return [...state.values()].find((event) => event.type === "tool_started");
}

/** What the turn-level row says while work is in flight. Never "Deep diving". */
function liveSummary(activity: AgentProgressEvent[]): string {
  const tool = activeTool(activity);
  if (tool) return `Working with ${labels[tool.agent]}`;
  const waiting = runningCount(activity);
  if (waiting > 0) {
    const agent = activeAgent(activity);
    if (agent) return `Working with ${labels[agent]}`;
    return `Waiting for ${waiting} ${waiting === 1 ? "subagent" : "subagents"}`;
  }
  const coordinator = [...activity].reverse().find((event) => event.type === "coordinator");
  if (coordinator) return coordinator.summary;
  const started = [...activity].reverse().find((event) => event.type === "agent_started");
  if (started?.type === "agent_started") return `Working with ${labels[started.agent]}`;
  return "Preparing your request.";
}

function groupByAgent(events: AgentProgressEvent[]): Map<AgentName, AgentProgressEvent[]> {
  const grouped = new Map<AgentName, AgentProgressEvent[]>();
  for (const name of AGENT_NAMES) grouped.set(name, []);
  for (const event of events) {
    if ("agent" in event) grouped.get(event.agent)?.push(event);
  }
  return grouped;
}

function reasoningBlocks(events: AgentProgressEvent[]): ReasoningEvent[] {
  return events.filter((event): event is ReasoningEvent => event.type === "agent_reasoning");
}

export interface ToolRowModel {
  started: StartedEvent;
  state: ToolState;
  summary: string;
  args?: Record<string, string>;
  resultCount?: number;
  resultRows?: { label: string; detail?: string }[];
  resultTruncated?: boolean;
}

function toolRows(events: AgentProgressEvent[]): ToolRowModel[] {
  const rows = new Map<string, ToolRowModel>();
  for (const event of events) {
    if (event.type === "tool_started") {
      rows.set(event.callId, {
        started: event,
        state: "running",
        summary: event.summary,
        ...(event.args ? { args: event.args } : {}),
      });
      continue;
    }
    if (event.type !== "tool_completed" && event.type !== "tool_failed") continue;
    const row = rows.get(event.callId);
    if (!row) continue;
    if (event.type === "tool_completed") {
      row.state = "completed";
      row.summary = event.resultSummary;
      if (event.resultCount !== undefined) row.resultCount = event.resultCount;
      if (event.resultRows) row.resultRows = event.resultRows;
      if (event.resultTruncated) row.resultTruncated = true;
    } else {
      row.state = "failed";
      row.summary = failText(event.error);
    }
  }
  return [...rows.values()];
}

export interface SubagentModel {
  name: AgentName;
  events: AgentProgressEvent[];
  reasoning: ReasoningEvent[];
  tools: ToolRowModel[];
  status: ActivityStatus;
  summary: string;
  objective?: string;
  constraints?: string[];
  outcome?: string;
  error?: string;
  choice?: Extract<AgentProgressEvent, { type: "agent_completed" }>["choice"];
  coordinator?: { summary: string; constraints?: string[] };
}

function subagentModel(
  name: AgentName,
  events: AgentProgressEvent[],
  busy: boolean,
  coordinator?: CoordinatorEvent,
): SubagentModel {
  const status = agentStatus(events, busy);
  const started = [...events].reverse().find((event) => event.type === "agent_started");
  const completed = [...events].reverse().find((event) => event.type === "agent_completed");
  const failed = [...events].reverse().find((event) => event.type === "agent_failed");
  return {
    name,
    events,
    reasoning: reasoningBlocks(events),
    tools: toolRows(events),
    status,
    summary: eventSummary(events, status),
    ...(started?.type === "agent_started" && started.objective
      ? { objective: started.objective }
      : {}),
    ...(started?.type === "agent_started" && started.constraints?.length
      ? { constraints: started.constraints }
      : {}),
    ...(completed?.type === "agent_completed" && completed.outcome
      ? { outcome: completed.outcome }
      : {}),
    ...(failed?.type === "agent_failed" ? { error: failText(failed.error) } : {}),
    ...(completed?.type === "agent_completed" && completed.choice
      ? { choice: completed.choice }
      : {}),
    ...(coordinator ? { coordinator: { summary: coordinator.summary, ...(coordinator.constraints?.length ? { constraints: coordinator.constraints } : {}) } } : {}),
  };
}

/** One round heading, then the subagents that worked in that round. */
interface RoundGroup {
  round: number;
  heading?: { summary: string; constraints?: string[] };
  subagents: SubagentModel[];
}

/** The rounds that actually contain work, in order. A bare event round with no
 *  lifecycle event is a synthesis phase, not a specialist round. */
function workRounds(activity: AgentProgressEvent[]): number[] {
  const rounds: number[] = [];
  for (const event of activity) {
    if (!isLifecycle(event) || rounds.includes(event.round)) continue;
    rounds.push(event.round);
  }
  return rounds.sort((a, b) => a - b);
}

function roundGroups(activity: AgentProgressEvent[], busy: boolean): RoundGroup[] {
  const incoming = new Map<number, AgentProgressEvent[]>();
  for (const event of activity) {
    const list = incoming.get(event.round);
    if (list) list.push(event);
    else incoming.set(event.round, [event]);
  }
  const rounds = workRounds(activity);
  if (rounds.length === 0) return [];
  const multiRound = rounds.length > 1;

  return rounds.map((round, index) => {
    const events = incoming.get(round) ?? [];
    const coordinatorEvent = events.find(
      (event): event is CoordinatorEvent => event.type === "coordinator",
    );
    const heading =
      multiRound && round > 1
        ? {
            summary: coordinatorEvent?.summary ?? `Round ${round} of the plan`,
            ...(coordinatorEvent?.constraints?.length
              ? { constraints: coordinatorEvent.constraints }
              : {}),
          }
        : undefined;
    const byAgent = groupByAgent(events);
    // The first round lists every specialist so the reader sees the whole cast
    // before any of them report; later rounds only show who actually worked.
    const names = index === 0 ? AGENT_NAMES : AGENT_NAMES.filter((name) => (byAgent.get(name)?.length ?? 0) > 0);
    const consumedCoordinator =
      heading !== undefined && coordinatorEvent !== undefined ? coordinatorEvent : undefined;
    return {
      round,
      ...(heading ? { heading } : {}),
      subagents: names.map((name) =>
        subagentModel(name, byAgent.get(name) ?? [], busy, consumedCoordinator),
      ),
    };
  });
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

/** DSH StateDot: 8px, a 10%-opacity halo and a 60%-scale core. Decorative only. */

// ---------------------------------------------------------------------------
// The turn
// ---------------------------------------------------------------------------

const EMPTY_EVENTS: AgentProgressEvent[] = [];

export interface DisclosureState {
  allExpanded: boolean | undefined;
  generation: number;
  expanded: (id: string) => boolean;
  toggle: (id: string) => void;
  setAll: (value: boolean) => void;
}

type DisclosureAnswers = {
  allExpanded: boolean | undefined;
  generation: number;
  /** Per-row answers keyed by the action generation that recorded them. */
  overrides: Record<string, Record<string, boolean>>;
};

interface DisclosureSnapshot extends DisclosureAnswers {
  defaultExpanded: boolean;
}

/**
 * One global expand/collapse action plus per-row local state. A row's own
 * toggle is stored under the generation it happened in; a global action bumps
 * the generation, which discards every earlier answer, so the global action
 * always wins and an individual toggle afterwards wins again. `expanded`
 * reads the latest answers from a ref, so a toggle that lands in the same
 * frame as a global action still reads the state the reader can see.
 */
function useDisclosure(defaultExpanded: boolean): DisclosureState {
  const [answers, setAnswers] = useState<DisclosureAnswers>({
    allExpanded: undefined,
    generation: 0,
    overrides: {},
  });
  const latest = useRef<DisclosureSnapshot>({ ...answers, defaultExpanded });
  latest.current = { ...answers, defaultExpanded };

  function expanded(id: string): boolean {
    const current = latest.current;
    const local = current.overrides[current.generation]?.[id];
    if (local !== undefined) return local;
    return current.allExpanded ?? current.defaultExpanded;
  }

  function toggle(id: string): void {
    const open = !expanded(id);
    setAnswers((current) => ({
      ...current,
      overrides: {
        ...current.overrides,
        [current.generation]: { ...current.overrides[current.generation], [id]: open },
      },
    }));
  }

  function setAll(value: boolean): void {
    setAnswers((current) => ({
      allExpanded: value,
      generation: current.generation + 1,
      overrides: current.overrides,
    }));
  }

  return { allExpanded: answers.allExpanded, generation: answers.generation, expanded, toggle, setAll };
}

function useElapsedMs(busy: boolean): number {
  const anchor = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) {
      anchor.current = null;
      setElapsed(0);
      return;
    }
    if (anchor.current === null) anchor.current = Date.now();
    const tick = () => setElapsed(Date.now() - (anchor.current ?? Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [busy]);
  return elapsed;
}

function ThinkRow({
  summary,
  counts,
  activity,
  busy,
  error,
  disclosure,
}: {
  summary: string;
  counts: Counts;
  activity: AgentProgressEvent[];
  busy: boolean;
  error?: string;
  disclosure: DisclosureState;
}) {
  const expanded = disclosure.expanded("turn");
  const controlsVisible = activity.length > 0 || busy;
  const expandControlLabel = disclosure.allExpanded ? "Collapse all" : "Expand all";
  const agents = useMemo(
    () => AGENT_NAMES.filter((name) => activity.some((event) => "agent" in event && event.agent === name)),
    [activity],
  );
  return (
    <div className="thinking-turn">
      <div className="thinking-turn__row" data-state={busy ? "running" : error ? "error" : "ok"}>
        <button
          type="button"
          className="thinking-line thinking-line--turn"
          aria-expanded={expanded}
          onClick={() => disclosure.toggle("turn")}
        >
          <span className="thinking-line__leading" aria-hidden="true">
            <ThinkIcon />
          </span>
          <span className="thinking-line__kind">Think</span>
          <span className="thinking-line__separator" aria-hidden="true">
            ·
          </span>
          <span className="thinking-line__summary" title={summary}>
            {summary}
          </span>
          <span className="thinking-line__chevron" aria-hidden="true">
            <ChevronIcon />
          </span>
        </button>
        {controlsVisible && (
          <span className="thinking-line__controls">
            <button
              type="button"
              className="thinking-control"
              aria-label={expandControlLabel}
              title={expandControlLabel}
              onClick={() => disclosure.setAll(!disclosure.allExpanded)}
            >
              {disclosure.allExpanded ? <CollapseAllIcon /> : <ExpandAllIcon />}
            </button>
          </span>
        )}
      </div>
      {expanded && (
        <div className="thinking-turn__body">
          {countLine(counts) && <p className="thinking-note__summary">{countLine(counts)}</p>}
          {agents.length > 0 && (
            <ul className="thinking-note__list">
              {agents.map((name) => (
                <li key={name}>{labels[name]}</li>
              ))}
            </ul>
          )}
          {!busy && error && <p className="thinking-error">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function ThinkingProcess({
  activity,
  busy,
  error,
}: {
  activity: AgentProgressEvent[];
  busy: boolean;
  error?: string;
}) {
  const counts = useMemo(() => countActivity(activity), [activity]);
  // A successful run folds so a finished conversation reads as a conversation;
  // while work is in flight, or after a failure, the process rows stay open so
  // the reader can watch the work happen and see what broke.
  const foldable = !busy && !error;
  const disclosure = useDisclosure(false);
  const foldOpen = !foldable || disclosure.expanded("turn");
  const elapsed = useElapsedMs(busy);
  const groups = useMemo(() => roundGroups(activity, busy), [activity, busy]);
  const multiRound = groups.length > 1;

  const summary = foldable
    ? countLine(counts) || "Trip plan ready"
    : busy
      ? liveSummary(activity)
      : countLine(counts) || "Needs attention";

  const rows: ReactNode[] = [];
  // Exactly one running line, only while the turn is in flight.
  if (busy) rows.push(<RunningLine key="running" elapsedMs={elapsed} />);

  if (foldOpen) {
    if (groups.length === 0) {
      rows.push(
        <div className="thinking-subagents" role="list" aria-label="Subagents thinking together" key="list">
          {AGENT_NAMES.map((name) => (
            <SubagentRow
              key={name}
              model={subagentModel(name, EMPTY_EVENTS, busy)}
              disclosure={disclosure}
            />
          ))}
        </div>,
      );
    } else {
      groups.forEach((group) => {
        rows.push(
          <div className="thinking-round-group" key={`round-${group.round}`}>
            {multiRound && group.heading && (
              <RoundHeading
                round={group.round}
                summary={group.heading.summary}
                {...(group.heading.constraints ? { constraints: group.heading.constraints } : {})}
              />
            )}
            <div className="thinking-subagents" role="list" aria-label="Subagents thinking together">
              {group.subagents.map((model) => (
                <SubagentRow key={model.name} model={model} disclosure={disclosure} />
              ))}
            </div>
          </div>,
        );
      });
    }
  }

  return (
    <div className="thinking-process">
      <ThinkRow
        summary={summary}
        counts={counts}
        activity={activity}
        busy={busy}
        {...(error ? { error } : {})}
        disclosure={disclosure}
      />
      {rows}
    </div>
  );
}
