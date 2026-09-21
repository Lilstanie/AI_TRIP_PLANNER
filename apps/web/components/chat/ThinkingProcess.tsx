import { useMemo, useState } from "react";
import { AGENT_NAMES, type AgentName, type AgentProgressEvent } from "@trip/shared";
import { cn } from "@/lib/utils";
import { SubagentIcon, ThinkIcon, ToolIcon } from "../ui/icons";

export type ActivityStatus =
  "queued" | "running" | "revising" | "completed" | "failed" | "interrupted" | "unknown";

const labels: Record<AgentName, string> = {
  itinerary: "Day plan",
  transport: "Getting around",
  accommodation: "Stay",
  "destination-guide": "Destination guide",
  dining: "Food & dining",
};

const statusLabels: Record<ActivityStatus, string> = {
  queued: "Waiting",
  running: "Thinking",
  revising: "Revising",
  completed: "Complete",
  failed: "Needs attention",
  interrupted: "Interrupted",
  unknown: "Waiting for update",
};

type ToolProgressEvent = Extract<
  AgentProgressEvent,
  { type: "tool_started" | "tool_completed" | "tool_failed" }
>;
type AgentLifecycleEvent = Extract<
  AgentProgressEvent,
  { type: "agent_started" | "agent_completed" | "agent_failed" }
>;

function isToolEvent(event: AgentProgressEvent): event is ToolProgressEvent {
  return (
    event.type === "tool_started" || event.type === "tool_completed" || event.type === "tool_failed"
  );
}

function latestLifecycle(events: AgentProgressEvent[]): AgentLifecycleEvent | undefined {
  return [...events]
    .reverse()
    .find((event): event is AgentLifecycleEvent => event.type.startsWith("agent_"));
}

function agentStatus(events: AgentProgressEvent[], busy: boolean): ActivityStatus {
  const event = latestLifecycle(events);
  if (!event) return events.length > 0 ? "unknown" : busy ? "queued" : "interrupted";
  if (event.type === "agent_failed") return "failed";
  if (event.type === "agent_completed") return "completed";
  if (event.type === "agent_started") return event.round > 1 ? "revising" : "running";
  return "unknown";
}

function statusIcon(status: ActivityStatus): string {
  switch (status) {
    case "running":
    case "revising":
      return "·";
    case "completed":
      return "✓";
    case "failed":
      return "!";
    case "interrupted":
      return "■";
    default:
      return "○";
  }
}

function eventSummary(events: AgentProgressEvent[], status: ActivityStatus): string {
  const latest = latestLifecycle(events);
  const latestTool = [...events].reverse().find(isToolEvent);
  if (status === "failed" && latest?.type === "agent_failed") return latest.error;
  if (status === "running" || status === "revising") {
    if (latestTool?.type === "tool_started") return `Deep diving · ${latestTool.label}`;
    if (latestTool?.type === "tool_completed") {
      return `${latestTool.label} · ${latestTool.resultSummary}`;
    }
    return latest?.type === "agent_started" && latest.summary
      ? latest.summary
      : statusLabels[status];
  }
  if (status === "completed" && latest?.type === "agent_completed" && latest.summary) {
    return latest.summary;
  }
  return statusLabels[status];
}

function latestCoordinator(activity: AgentProgressEvent[]): AgentProgressEvent | undefined {
  return [...activity].reverse().find((event) => event.type === "coordinator");
}

function runningTool(activity: AgentProgressEvent[]): ToolProgressEvent | undefined {
  const state = new Map<string, ToolProgressEvent>();
  for (const event of activity) {
    if (isToolEvent(event)) state.set(event.callId, event);
  }
  return [...state.values()].find((event) => event.type === "tool_started");
}

function processSummary(activity: AgentProgressEvent[], busy: boolean, error?: string): string {
  if (error && !busy) return "Needs attention";
  if (!busy) return "Trip plan ready";
  if (runningTool(activity)) return "Deep diving…";
  const latest = latestCoordinator(activity);
  const active = [...activity].reverse().find((event) => {
    if (event.type !== "agent_started") return false;
    return !activity.some(
      (candidate) =>
        candidate.type === "agent_completed" &&
        candidate.agent === event.agent &&
        candidate.round === event.round,
    );
  });
  if (active?.type === "agent_started") return `Working with ${labels[active.agent]}`;
  if (latest?.type === "coordinator") return latest.summary;
  return "Working with subagents";
}

interface ToolRowModel {
  started: Extract<ToolProgressEvent, { type: "tool_started" }>;
  state: "running" | "completed" | "failed";
  summary: string;
}

function toolRows(events: AgentProgressEvent[]): ToolRowModel[] {
  const rows = new Map<string, ToolRowModel>();
  for (const event of events) {
    if (event.type === "tool_started") {
      rows.set(event.callId, { started: event, state: "running", summary: event.summary });
    } else if (event.type === "tool_completed") {
      const row = rows.get(event.callId);
      if (row) {
        row.state = "completed";
        row.summary = event.resultSummary;
      }
    } else if (event.type === "tool_failed") {
      const row = rows.get(event.callId);
      if (row) {
        row.state = "failed";
        row.summary = event.error;
      }
    }
  }
  return [...rows.values()];
}

function ToolActivityRow({ row }: { row: ToolRowModel }) {
  const icon = row.state === "completed" ? "✓" : row.state === "failed" ? "!" : "·";
  return (
    <div
      className={cn("thinking-tool", `thinking-tool--${row.state}`)}
      data-state={row.state}
      role="group"
      aria-label={`${row.started.label} ${row.state}`}
    >
      <span className="thinking-tool__icon" aria-hidden="true">
        <ToolIcon tool={row.started.tool} />
      </span>
      <span className="thinking-tool__title">{row.started.label}</span>
      <span className="thinking-tool__separator" aria-hidden="true">
        ·
      </span>
      <span className="thinking-tool__summary" title={row.summary}>
        {row.summary}
      </span>
      <span className="thinking-tool__state" aria-hidden="true">
        {icon}
      </span>
    </div>
  );
}

function DetailBlock({ events }: { events: AgentProgressEvent[] }) {
  return (
    <div className="thinking-row__details">
      {events.length === 0 ? (
        <span>Waiting for assignment.</span>
      ) : (
        events.map((event, index) => (
          <div key={`${event.type}-${event.round}-${index}`}>
            <strong>Round {event.round}</strong>
            {"summary" in event && event.summary && <span>{event.summary}</span>}
            {"constraints" in event && event.constraints?.length ? (
              <ul>
                {event.constraints.map((constraint) => (
                  <li key={constraint}>{constraint}</li>
                ))}
              </ul>
            ) : null}
            {event.type === "agent_failed" && <span className="error-text">{event.error}</span>}
          </div>
        ))
      )}
    </div>
  );
}

function SubagentRow({
  name,
  events,
  busy,
}: {
  name: AgentName;
  events: AgentProgressEvent[];
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = agentStatus(events, busy);
  const summary = eventSummary(events, status);
  const label = labels[name];
  const actions = toolRows(events);

  return (
    <div
      className={cn("thinking-subagent", `thinking-subagent--${status}`)}
      data-status={status}
      role="listitem"
      aria-label={`${label} ${statusLabels[status]}`}
    >
      <div className="thinking-subagent__icon" aria-hidden="true">
        <SubagentIcon />
      </div>
      <span className="thinking-subagent__kind">Subagent</span>
      <span className="thinking-subagent__separator" aria-hidden="true">
        ·
      </span>
      <span className="thinking-subagent__name">{label}</span>
      <span className="thinking-subagent__summary" title={summary}>
        {summary}
      </span>
      <button
        type="button"
        className="thinking-subagent__toggle"
        aria-label={`${label} details`}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span aria-hidden="true">{statusIcon(status)}</span>
      </button>
      {expanded && <DetailBlock events={events} />}
      {actions.length > 0 && (
        <div className="thinking-subagent__tools" aria-label={`${label} tools`}>
          {actions.map((row) => (
            <ToolActivityRow key={row.started.callId} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function ThinkRow({
  activity,
  busy,
  error,
}: {
  activity: AgentProgressEvent[];
  busy: boolean;
  error?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = processSummary(activity, busy, error);
  const completed = new Set(
    activity.filter((event) => event.type === "agent_completed").map((event) => event.agent),
  ).size;
  const coordinator = latestCoordinator(activity);
  const status = error && !busy ? "error" : busy ? "running" : "ok";

  return (
    <div className="thinking-root" data-state={status} data-expanded={expanded || undefined}>
      {busy && <span className="thinking-root__live">Thinking is in progress</span>}
      <button
        type="button"
        className="thinking-row"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="thinking-row__icon" aria-hidden="true">
          <ThinkIcon />
        </span>
        <span className="thinking-row__kind">Think</span>
        <span className="thinking-row__separator" aria-hidden="true">
          ·
        </span>
        <span className="thinking-row__summary" title={summary}>
          {summary}
        </span>
        <span className="thinking-row__chevron" aria-hidden="true">
          ⌄
        </span>
      </button>
      {expanded && (
        <div className="thinking-row__expanded">
          <span>{`${completed}/${AGENT_NAMES.length} subagents have reported back.`}</span>
          {coordinator?.type === "coordinator" && <span>{coordinator.summary}</span>}
        </div>
      )}
      {busy && (
        <div className="thinking-deep-dive" aria-live="polite">
          <span className="thinking-deep-dive__dot" aria-hidden="true" />
          <span>
            Deep diving
            <span className="thinking-deep-dive__ellipsis" aria-hidden="true">
              …
            </span>
          </span>
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
  const eventsByAgent = useMemo(() => {
    const grouped = new Map<AgentName, AgentProgressEvent[]>();
    for (const name of AGENT_NAMES) grouped.set(name, []);
    for (const event of activity) {
      if ("agent" in event) grouped.get(event.agent)?.push(event);
    }
    return grouped;
  }, [activity]);

  return (
    <div className="thinking-process" aria-live="polite">
      <ThinkRow activity={activity} busy={busy} error={error} />
      <div className="thinking-subagents" role="list" aria-label="Subagents thinking together">
        {AGENT_NAMES.map((name) => (
          <SubagentRow key={name} name={name} events={eventsByAgent.get(name) ?? []} busy={busy} />
        ))}
      </div>
    </div>
  );
}
