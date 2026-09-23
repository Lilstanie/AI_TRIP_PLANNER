import {
  AGENT_NAMES,
  type AgentName,
  type AgentProgressEvent,
  type ToolResultKind,
  type ToolResultRow,
} from "@trip/shared";

// ---------------------------------------------------------------------------
// The thinking transcript's model, derived from the streamed `activity`. The
// tree it describes is Think (the turn) → Subagent rows per round → each
// subagent's reasoning and tool rows → a tool's result rows. Nothing here is
// React; ThinkingProcess and ThinkingRows render it.
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
export type ToolState = "running" | "completed" | "failed";
/** StatusDot visuals: running/queued/completed plus the error colour for failures. */
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
type ReasoningEvent = Extract<AgentProgressEvent, { type: "agent_reasoning" }>;
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

export function dotState(status: ActivityStatus): DotState {
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

export function failText(error: unknown): string {
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

// --- Reasoning: one block per model call -----------------------------------

/** The first line of a reasoning block: what a settled model call concluded. */
export function firstLine(text: string): string {
  const newline = text.indexOf("\n");
  return newline === -1 ? text : text.slice(0, newline);
}

/** The last non-empty line: what a streaming model call is doing now. */
export function latestLine(text: string): string {
  const visible = text.trimEnd();
  const newline = visible.lastIndexOf("\n");
  return newline === -1 ? visible : visible.slice(newline + 1);
}

/** A collapsed summary drops double-asterisk markers; the body keeps them. */
export function reasoningSummary(text: string, running: boolean): string {
  return (running ? latestLine(text) : firstLine(text.trimStart())).replaceAll("**", "");
}

export interface ReasoningBlock {
  /** Disclosure id: one block per (agent, round, episode). */
  id: string;
  agent: AgentName;
  round: number;
  episode: number;
  text: string;
  /** Position of the block's first and latest delta in the event list it came from. */
  first: number;
  last: number;
  /** Still streaming: the turn is busy and its agent has not moved on since. */
  running: boolean;
}

export function reasoningId(agent: AgentName, round: number, episode: number): string {
  return `reason:${agent}:${round}:${episode}`;
}

/** An event that ends a model call's thinking: the agent acted or settled. */
function movesOn(event: AgentProgressEvent): boolean {
  return (
    event.type === "tool_started" ||
    event.type === "tool_completed" ||
    event.type === "tool_failed" ||
    event.type === "agent_completed" ||
    event.type === "agent_failed"
  );
}

/**
 * Merge reasoning deltas into one block per model call, keyed by
 * (agent, round, episode) and concatenated in arrival order. That is correct
 * both for the current emitter, which gives every delta of one call the same
 * index, and for older frames that numbered each paced flush separately.
 */
export function mergeReasoning(events: AgentProgressEvent[], busy: boolean): ReasoningBlock[] {
  const blocks = new Map<string, ReasoningBlock>();
  events.forEach((event, position) => {
    if (event.type !== "agent_reasoning") return;
    const reasoning: ReasoningEvent = event;
    const episode = reasoning.episode ?? 0;
    const id = reasoningId(reasoning.agent, reasoning.round, episode);
    const block = blocks.get(id);
    if (block) {
      block.text += reasoning.text;
      block.last = position;
      return;
    }
    blocks.set(id, {
      id,
      agent: reasoning.agent,
      round: reasoning.round,
      episode,
      text: reasoning.text,
      first: position,
      last: position,
      running: false,
    });
  });
  const merged = [...blocks.values()];
  if (!busy) return merged;
  // The newest block of each agent streams until that agent acts or settles.
  const newest = new Map<AgentName, ReasoningBlock>();
  for (const block of merged) {
    const current = newest.get(block.agent);
    if (!current || block.last > current.last) newest.set(block.agent, block);
  }
  for (const block of newest.values()) {
    block.running = !events
      .slice(block.last + 1)
      .some((event) => "agent" in event && event.agent === block.agent && movesOn(event));
  }
  return merged;
}

/** The newest streaming block of the whole turn, if any is streaming. */
function streamingBlock(blocks: ReasoningBlock[]): ReasoningBlock | undefined {
  let latest: ReasoningBlock | undefined;
  for (const block of blocks) if (block.running && (!latest || block.last > latest.last)) latest = block;
  return latest;
}

// --- Tools -----------------------------------------------------------------

export interface ToolRowModel {
  started: StartedEvent;
  state: ToolState;
  summary: string;
  /** Position of the call's start in the event list it came from. */
  first: number;
  args?: Record<string, string>;
  resultCount?: number;
  resultRows?: ToolResultRow[];
  resultTruncated?: boolean;
}

const TOOL_KINDS: Record<string, ToolResultKind> = {
  "maps.places": "place",
  "maps.route": "route",
  "maps.routeOptions": "route",
  "booking.searchStays": "stay",
  "booking.searchFlights": "flight",
  "weather.forecast": "weather",
};

/** A result row's glyph: its own kind, else what the tool that found it returns. */
export function resultKind(row: ToolResultRow, tool: string): ToolResultKind {
  return row.kind ?? TOOL_KINDS[tool] ?? "place";
}

/**
 * The site a result row came from, as a bare host. Only an http(s) page has
 * one; a row without a url, or with anything else in it, has no site and keeps
 * its category glyph.
 */
export function resultHost(row: ToolResultRow): string | undefined {
  if (!row.url) return undefined;
  try {
    const { protocol, hostname } = new URL(row.url);
    if (protocol !== "http:" && protocol !== "https:") return undefined;
    return hostname || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Where the site's icon comes from: Google's public favicon service, asked for
 * the host alone. The row's own url — which can carry a provider's query
 * string — is never sent, and the request carries no referrer (see the img in
 * ThinkingRows).
 */
export function faviconSrc(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
}

// --- Tool arguments --------------------------------------------------------

/** One tool call's arguments as one line: a journey, a date, then the rest. */
export interface ArgLine {
  /** `from → to`, only when the call named both ends of a journey. */
  journey?: { from: string; to: string };
  /** The call's date, when it has the one plain `date` argument. */
  date?: string;
  /** Everything else, in the order the emitter sent it. */
  chips: Array<{ key: string; value: string }>;
}

/**
 * Split arguments into the parts the row renders. `from`/`to` only read as a
 * journey together — one of them alone is just another argument and stays a
 * chip, because "Sydney →" says nothing.
 */
export function argLine(args: Record<string, string>): ArgLine {
  const entries = Object.entries(args).filter(([, value]) => value.trim().length > 0);
  const lookup = new Map(entries);
  const from = lookup.get("from");
  const to = lookup.get("to");
  const journey = from && to ? { from, to } : undefined;
  const date = lookup.get("date");
  const used = new Set([...(journey ? ["from", "to"] : []), ...(date ? ["date"] : [])]);
  return {
    ...(journey ? { journey } : {}),
    ...(date ? { date } : {}),
    chips: entries
      .filter(([key]) => !used.has(key))
      .map(([key, value]) => ({ key, value })),
  };
}

function toolRows(events: AgentProgressEvent[]): ToolRowModel[] {
  const rows = new Map<string, ToolRowModel>();
  events.forEach((event, position) => {
    if (event.type === "tool_started") {
      rows.set(event.callId, {
        started: event,
        state: "running",
        summary: event.summary,
        first: position,
        ...(event.args ? { args: event.args } : {}),
      });
      return;
    }
    if (event.type !== "tool_completed" && event.type !== "tool_failed") return;
    const row = rows.get(event.callId);
    if (!row) return;
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
  });
  return [...rows.values()];
}

// --- Subagents -------------------------------------------------------------

/** A subagent's children in the order they happened: model calls and tool calls. */
export type SubagentStep =
  | { kind: "reasoning"; block: ReasoningBlock }
  | { kind: "tool"; row: ToolRowModel };

export interface SubagentModel {
  /** Disclosure id: one row per (round, agent). */
  id: string;
  name: AgentName;
  round: number;
  steps: SubagentStep[];
  status: ActivityStatus;
  summary: string;
  /** The summary is a streaming reasoning line, so it follows its end. */
  streaming: boolean;
  objective?: string;
  constraints?: string[];
  outcome?: string;
  error?: string;
  choice?: Extract<AgentProgressEvent, { type: "agent_completed" }>["choice"];
  coordinator?: { summary: string; constraints?: string[] };
}

/** Whether the subagent row has anything to disclose. */
export function subagentHasBody(model: SubagentModel): boolean {
  return Boolean(
    model.steps.length ||
      model.objective ||
      model.constraints ||
      model.outcome ||
      model.error ||
      model.choice ||
      model.coordinator,
  );
}

export function subagentModel(
  name: AgentName,
  round: number,
  events: AgentProgressEvent[],
  busy: boolean,
  coordinator?: CoordinatorEvent,
): SubagentModel {
  const status = agentStatus(events, busy);
  const started = [...events].reverse().find((event) => event.type === "agent_started");
  const completed = [...events].reverse().find((event) => event.type === "agent_completed");
  const failed = [...events].reverse().find((event) => event.type === "agent_failed");
  const blocks = mergeReasoning(events, busy);
  const steps: SubagentStep[] = [
    ...blocks.map((block) => ({ kind: "reasoning" as const, block, at: block.first })),
    ...toolRows(events).map((row) => ({ kind: "tool" as const, row, at: row.first })),
  ]
    .sort((a, b) => a.at - b.at)
    .map(({ at: _at, ...step }) => step as SubagentStep);
  const stream = streamingBlock(blocks);
  return {
    id: `agent:${round}:${name}`,
    name,
    round,
    steps,
    status,
    summary: stream ? reasoningSummary(stream.text, true) : eventSummary(events, status),
    streaming: Boolean(stream),
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
    ...(coordinator
      ? {
          coordinator: {
            summary: coordinator.summary,
            ...(coordinator.constraints?.length ? { constraints: coordinator.constraints } : {}),
          },
        }
      : {}),
  };
}

// --- The turn --------------------------------------------------------------

export interface Counts {
  toolCalls: number;
  subagents: number;
  rounds: number;
}

export function countActivity(activity: AgentProgressEvent[]): Counts {
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
export function countLine(counts: Counts): string {
  const parts: string[] = [];
  if (counts.toolCalls > 0)
    parts.push(`${counts.toolCalls} tool ${counts.toolCalls === 1 ? "call" : "calls"}`);
  if (counts.subagents > 0)
    parts.push(`${counts.subagents} ${counts.subagents === 1 ? "subagent" : "subagents"}`);
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
    if (event.type === "agent_completed" || event.type === "agent_failed")
      open.set(event.agent, false);
  }
  let count = 0;
  for (const running of open.values()) if (running) count += 1;
  return count;
}

function activeTool(activity: AgentProgressEvent[]): StartedEvent | undefined {
  const state = new Map<string, ToolProgressEvent>();
  for (const event of activity) if (isToolEvent(event)) state.set(event.callId, event);
  let latest: StartedEvent | undefined;
  for (const event of state.values()) if (event.type === "tool_started") latest = event;
  return latest;
}

/** What the turn row says while work is in flight and no model is mid-thought. */
function liveSummary(activity: AgentProgressEvent[]): string {
  const tool = activeTool(activity);
  if (tool) return `${labels[tool.agent]} · ${tool.summary}`;
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

/**
 * The Think row's collapsed summary. While busy it follows the newest
 * streaming reasoning line (right-anchored, so it visibly advances) when that
 * is the latest work in the turn, else the live tool or subagent line; once
 * settled it is the count line.
 */
export function turnSummary(
  activity: AgentProgressEvent[],
  counts: Counts,
  busy: boolean,
  error?: string,
): { text: string; streaming: boolean } {
  if (busy) {
    // Reasoning leads only while it is the newest work in the turn; once any
    // agent acts after it, the row follows that action instead.
    let newest = -1;
    activity.forEach((event, position) => {
      if (isLifecycle(event) || isToolEvent(event) || event.type === "agent_reasoning")
        newest = position;
    });
    const stream = streamingBlock(mergeReasoning(activity, true));
    if (stream && stream.last === newest)
      return { text: reasoningSummary(stream.text, true), streaming: true };
    return { text: liveSummary(activity), streaming: false };
  }
  return { text: countLine(counts) || (error ? "Needs attention" : "Trip plan ready"), streaming: false };
}

function groupByAgent(events: AgentProgressEvent[]): Map<AgentName, AgentProgressEvent[]> {
  const grouped = new Map<AgentName, AgentProgressEvent[]>();
  for (const name of AGENT_NAMES) grouped.set(name, []);
  for (const event of events) {
    if ("agent" in event) grouped.get(event.agent)?.push(event);
  }
  return grouped;
}

/** One round heading, then the subagents that worked in that round. */
export interface RoundGroup {
  round: number;
  heading?: { summary: string; constraints?: string[] };
  subagents: SubagentModel[];
}

/** The rounds that contain work, in order. A round with only coordinator
 *  events is a synthesis phase, not a specialist round. Reasoning and tool
 *  calls count as work, so they always have a subagent row to live in; an
 *  event type this client does not know is not work. */
function workRounds(activity: AgentProgressEvent[]): number[] {
  const rounds: number[] = [];
  for (const event of activity) {
    const work = isLifecycle(event) || isToolEvent(event) || event.type === "agent_reasoning";
    if (!work || rounds.includes(event.round)) continue;
    rounds.push(event.round);
  }
  return rounds.sort((a, b) => a - b);
}

export function roundGroups(activity: AgentProgressEvent[], busy: boolean): RoundGroup[] {
  const incoming = new Map<number, AgentProgressEvent[]>();
  for (const event of activity) {
    const list = incoming.get(event.round);
    if (list) list.push(event);
    else incoming.set(event.round, [event]);
  }
  const rounds = workRounds(activity);
  if (rounds.length === 0) {
    // Nothing reported yet: the whole cast waits in round 1.
    return [
      { round: 1, subagents: AGENT_NAMES.map((name) => subagentModel(name, 1, [], busy)) },
    ];
  }
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
    const names =
      index === 0
        ? AGENT_NAMES
        : AGENT_NAMES.filter((name) => (byAgent.get(name)?.length ?? 0) > 0);
    const consumedCoordinator =
      heading !== undefined && coordinatorEvent !== undefined ? coordinatorEvent : undefined;
    return {
      round,
      ...(heading ? { heading } : {}),
      subagents: names.map((name) =>
        subagentModel(name, round, byAgent.get(name) ?? [], busy, consumedCoordinator),
      ),
    };
  });
}
