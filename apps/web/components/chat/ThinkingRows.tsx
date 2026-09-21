"use client";
import type { AgentName, AgentProgressEvent } from "@trip/shared";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronIcon, SubagentIcon, ThinkIcon, ToolIcon } from "../ui/icons";
import {
  CLOCK_DELAY_MS,
  labels,
  statusLabels,
  type ActivityStatus,
  type DotState,
  type DisclosureState,
  type ReasoningEvent,
  type SubagentModel,
  type ToolRowModel,
} from "./ThinkingProcess";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// The thinking transcript's rows: the disclosure chrome, the subagent and tool
// rows, their expanded bodies, and the turn's one running line. All state
// arrives from ThinkingProcess, so every row stays a pure function of it.
// ---------------------------------------------------------------------------

/** The dot that says how a row went: running, done, failed, or still waiting. */
function dotState(status: ActivityStatus): DotState {
  if (status === "failed") return "failed";
  if (status === "completed") return "completed";
  if (status === "running" || status === "revising") return "running";
  return "queued";
}

export function StatusDot({ state }: { state: DotState }) {
  return <span className={cn("thinking-dot", `thinking-dot--${state}`)} aria-hidden="true" />;
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="thinking-visually-hidden">{children}</span>;
}

function Disclosure({
  className,
  leading,
  expanded,
  onToggle,
  children,
  body,
}: {
  className?: string;
  leading: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  body?: ReactNode;
}) {
  return (
    <div className={cn("thinking-disclosure", className)} data-expanded={expanded || undefined}>
      <button
        type="button"
        className="thinking-line"
        data-expanded={expanded || undefined}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="thinking-line__leading" aria-hidden="true">
          {leading}
        </span>
        {children}
        <span className="thinking-line__chevron" aria-hidden="true">
          <ChevronIcon />
        </span>
      </button>
      {expanded && body}
    </div>
  );
}

/**
 * The stable identity of one reasoning block: the agent whose row carries it,
 * the round it belongs to, which model call chain produced it, and its position
 * in that chain.
 */
export function reasoningId(
  agent: AgentName,
  block: { round: number; episode: number; index: number },
): string {
  return `reason:${agent}:${block.round}:${block.episode}:${block.index}`;
}

export function ReasoningRow({
  block,
  running,
  expanded,
  onToggle,
}: {
  block: ReasoningEvent;
  running: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const trimmed = block.text.trimEnd();
  const lines = trimmed.split("\n");
  const source = running ? (lines.at(-1) ?? "") : (lines[0] ?? "");
  const summary = source.replaceAll("**", "");
  return (
    <Disclosure
      className="thinking-reasoning"
      leading={<ThinkIcon />}
      expanded={expanded}
      onToggle={onToggle}
      body={<div className="thinking-reasoning__body">{block.text}</div>}
    >
      <span className="thinking-line__kind">Think</span>
      <span className="thinking-line__separator" aria-hidden="true">
        ·
      </span>
      <span className="thinking-line__summary" title={summary}>
        {summary}
      </span>
    </Disclosure>
  );
}

export function ToolRow({
  row,
  expanded,
  onToggle,
}: {
  row: ToolRowModel;
  expanded: boolean;
  onToggle: () => void;
}) {
  // A call with nothing to disclose stays a plain row: the arguments and the
  // result rows are the only detail a tool row has.
  const hasBody = Boolean(row.args && Object.keys(row.args).length) || Boolean(row.resultRows?.length);
  const stateLabel =
    row.state === "running" ? "running" : row.state === "completed" ? "completed" : "failed";
  const open = hasBody && expanded;

  if (!hasBody) {
    return (
      <div className="thinking-tool" role="group" aria-label={`${row.started.label} ${stateLabel}`}>
        <span className="thinking-tool__leading" aria-hidden="true">
          <ToolIcon tool={row.started.tool} />
        </span>
        <span className="thinking-tool__title">{row.started.label}</span>
        <span className="thinking-tool__separator" aria-hidden="true">
          ·
        </span>
        <span className="thinking-tool__summary" title={row.summary}>
          {row.summary}
        </span>
      </div>
    );
  }

  return (
    <Disclosure
      className={cn("thinking-tool", `thinking-tool--${row.state}`)}
      leading={<ToolIcon tool={row.started.tool} />}
      expanded={open}
      onToggle={onToggle}
      body={
        <div className="thinking-tool__body">
          {row.args && Object.keys(row.args).length > 0 && (
            <dl className="thinking-tool__args">
              {Object.entries(row.args).map(([key, value]) => (
                <div className="thinking-tool__arg" key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="thinking-tool__result">{row.summary}</p>
          {row.resultRows && row.resultRows.length > 0 && (
            <ul className="thinking-tool__rows">
              {row.resultRows.map((item, index) => (
                <li className="thinking-tool__row" key={`${item.label}-${index}`}>
                  <span className="thinking-tool__row-label">{item.label}</span>
                  {item.detail && <span className="thinking-tool__row-detail">{item.detail}</span>}
                </li>
              ))}
            </ul>
          )}
          {row.resultTruncated && (
            <p className="thinking-tool__truncated">
              {`Showing the first ${row.resultRows?.length ?? 0} of ${row.resultCount ?? row.resultRows?.length ?? 0}`}
            </p>
          )}
        </div>
      }
    >
      <span className="thinking-tool__title">{row.started.label}</span>
      <span className="thinking-tool__separator" aria-hidden="true">
        ·
      </span>
      <span className="thinking-tool__summary" title={row.summary}>
        {row.summary}
      </span>
    </Disclosure>
  );
}

function ChoiceBlock({
  choice,
  expanded,
  onToggle,
}: {
  choice: NonNullable<SubagentModel["choice"]>;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="thinking-choice">
      <p className="thinking-choice__title">{choice.title}</p>
      <p className="thinking-choice__selected">
        <span className="thinking-choice__check" aria-hidden="true">
          <CheckIcon />
        </span>
        <span className="thinking-choice__label">{choice.selected.label}</span>
        {choice.selected.detail && (
          <span className="thinking-choice__detail">{choice.selected.detail}</span>
        )}
      </p>
      {choice.rationale && <p className="thinking-choice__rationale">{choice.rationale}</p>}
      {choice.alternatives.length > 0 && (
        <div className="thinking-choice__other">
          <button
            type="button"
            className="thinking-choice__toggle"
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <span className="thinking-choice__chevron" aria-hidden="true">
              <ChevronIcon />
            </span>
            {`Other options (${choice.alternatives.length})`}
          </button>
          {expanded && (
            <ul className="thinking-choice__alternatives">
              {choice.alternatives.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  <span className="thinking-choice__label">{item.label}</span>
                  {item.detail && <span className="thinking-choice__detail">{item.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SubagentBody({
  model,
  disclosure,
}: {
  model: SubagentModel;
  disclosure: { expanded: (id: string) => boolean; toggle: (id: string) => void };
}) {
  const hasBody = Boolean(
    model.objective ||
      model.constraints ||
      model.outcome ||
      model.error ||
      model.choice ||
      model.coordinator,
  );
  if (!hasBody) return null;
  return (
    <div className="thinking-subagent__body">
      {model.coordinator && (
        <div className="thinking-note">
          <p className="thinking-note__summary">{model.coordinator.summary}</p>
          {model.coordinator.constraints && (
            <ul className="thinking-note__list">
              {model.coordinator.constraints.map((constraint, index) => (
                <li key={`${constraint}-${index}`}>{constraint}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {model.objective && (
        <p className="thinking-note__summary">{`Asked for: ${model.objective}`}</p>
      )}
      {model.constraints && (
        <ul className="thinking-note__list">
          {model.constraints.map((constraint, index) => (
            <li key={`${constraint}-${index}`}>{constraint}</li>
          ))}
        </ul>
      )}
      {model.error && <p className="thinking-error">{model.error}</p>}
      {model.outcome && <p className="thinking-note__summary">{model.outcome}</p>}
      {model.choice && (
        <ChoiceBlock
          choice={model.choice}
          expanded={disclosure.expanded(`choice:${model.name}`)}
          onToggle={() => disclosure.toggle(`choice:${model.name}`)}
        />
      )}
    </div>
  );
}

export function SubagentRow({
  model,
  disclosure,
}: {
  model: SubagentModel;
  disclosure: { expanded: (id: string) => boolean; toggle: (id: string) => void };
}) {
  const label = labels[model.name];
  const id = `agent:${model.name}`;
  const expanded = disclosure.expanded(id);
  return (
    <div
      className={cn("thinking-subagent", `thinking-subagent--${model.status}`)}
      data-status={model.status}
      role="listitem"
      aria-label={`${label} ${statusLabels[model.status]}`}
    >
      <Disclosure
        className="thinking-subagent__row"
        leading={<SubagentIcon />}
        expanded={expanded}
        onToggle={() => disclosure.toggle(id)}
        body={<SubagentBody model={model} disclosure={disclosure} />}
      >
        <span className="thinking-line__kind">Subagent</span>
        <span className="thinking-line__separator" aria-hidden="true">
          ·
        </span>
        <span className="thinking-line__name">{label}</span>
        <span className="thinking-line__summary" title={model.summary}>
          {model.summary}
        </span>
        <span className="thinking-subagent__status">
          <StatusDot state={dotState(model.status)} />
          <VisuallyHidden>{statusLabels[model.status]}</VisuallyHidden>
        </span>
      </Disclosure>
      {/* What the agent thought and what it called stays visible in the flow —
          the row's own disclosure only adds the outcome and the choice. */}
      {model.reasoning.length > 0 && (
        <div className="thinking-subagent__reasoning">
          {model.reasoning.map((block, index) => (
            <ReasoningRow
              /* A round can hold several episodes of thinking — the dispatch
                 supervisor, then one revision pass per conflict round — and each
                 numbers its blocks from zero, so the episode is part of the
                 identity along with the round and the index. */
              key={reasoningId(model.name, block)}
              block={block}
              running={model.status === "running" && index === model.reasoning.length - 1}
              expanded={disclosure.expanded(reasoningId(model.name, block))}
              onToggle={() => disclosure.toggle(reasoningId(model.name, block))}
            />
          ))}
        </div>
      )}
      {model.tools.length > 0 && (
        <div className="thinking-subagent__tools">
          {model.tools.map((row) => (
            <ToolRow
              key={row.started.callId}
              row={row}
              expanded={disclosure.expanded(`tool:${row.started.callId}`)}
              onToggle={() => disclosure.toggle(`tool:${row.started.callId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RoundHeading({
  round,
  summary,
  constraints,
}: {
  round: number;
  summary: string;
  constraints?: string[];
}) {
  return (
    <div className="thinking-round">
      <p className="thinking-round__title">{`Round ${round} · ${summary}`}</p>
      {constraints && constraints.length > 0 && (
        <ul className="thinking-round__list">
          {constraints.map((constraint, index) => (
            <li key={`${constraint}-${index}`}>{constraint}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RunningLine({ elapsedMs }: { elapsedMs: number }) {
  const showClock = elapsedMs >= CLOCK_DELAY_MS;
  return (
    <p className="thinking-running" role="status" aria-live="polite">
      <span className="thinking-running__label">
        Deep diving
        <span className="thinking-running__ellipsis" aria-hidden="true">
          …
        </span>
      </span>
      {showClock && (
        <span className="thinking-running__clock" aria-hidden="true">
          {`${Math.floor(elapsedMs / 1000)}s`}
        </span>
      )}
    </p>
  );
}
