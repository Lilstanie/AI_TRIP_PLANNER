"use client";
import { useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import type { ToolResultKind, ToolResultRow } from "@trip/shared";
import { cn } from "@/lib/utils";
import {
  FlowCheckIcon,
  FlowChevronDownIcon,
  FlowSubagentIcon,
  FlowThinkIcon,
  ResultKindIcon,
  ToolGlyph,
} from "../ui/flow-icons";
import { Disclosure, RowSeparator, RowSummary } from "./Disclosure";
import {
  argLine,
  CLOCK_DELAY_MS,
  dotState,
  faviconSrc,
  labels,
  reasoningSummary,
  resultHost,
  resultKind,
  statusLabels,
  subagentHasBody,
  type DotState,
  type ReasoningBlock,
  type SubagentModel,
  type ToolRowModel,
} from "./thinking-model";

// ---------------------------------------------------------------------------
// The thinking transcript's rows below the turn: subagents, their reasoning
// and tool rows, a tool's result rows, the model's choice, round headings and
// the turn's one running line. Open state arrives from ThinkingProcess, so
// every row stays a pure function of its props.
// ---------------------------------------------------------------------------

/** Which rows are open. Every row starts closed; a click opens only that row. */
export interface OpenRows {
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
}

/** The dot that says how a row went: running, done, failed, or still waiting. */
export function StatusDot({ state }: { state: DotState }) {
  return <span className={cn("thinking-dot", `thinking-dot--${state}`)} aria-hidden="true" />;
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="thinking-visually-hidden">{children}</span>;
}

/** One level of the tree: DSH's single rail rule, so rails align at every depth. */
export function Children({ children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="thinking-children" {...rest}>
      {children}
    </div>
  );
}

/** One model call's thinking. Running: the newest line, right-anchored. Settled: the first line. */
export function ReasoningRow({ block, open }: { block: ReasoningBlock; open: OpenRows }) {
  const summary = reasoningSummary(block.text, block.running);
  return (
    <>
      {block.running && <VisuallyHidden>Running</VisuallyHidden>}
      <Disclosure
        className="thinking-reasoning"
        icon={<FlowThinkIcon />}
        title="Think"
        state={block.running ? "running" : "ok"}
        open={open.isOpen(block.id)}
        expandable
        onToggle={() => open.toggle(block.id)}
        collapsedContent={
          <>
            <RowSeparator />
            <RowSummary text={summary} followEnd={block.running} />
          </>
        }
      >
        <div className="thinking-reasoning__body">{block.text}</div>
      </Disclosure>
    </>
  );
}

/**
 * One tool call's arguments on one line: `Sydney → Wollongong · 2026-11-24`,
 * with anything that is not a journey or a date following as a `key value`
 * chip. The separators are decoration — a screen reader hears "from Sydney to
 * Wollongong, 2026-11-24" instead of the arrows.
 */
function ToolArgs({ args }: { args: Record<string, string> }) {
  const { journey, date, chips } = argLine(args);
  if (!journey && !date && chips.length === 0) return null;
  return (
    <p className="thinking-tool__args">
      {journey && (
        <span className="thinking-tool__arg-journey">
          <VisuallyHidden>from </VisuallyHidden>
          <span className="thinking-tool__arg-value">{journey.from}</span>
          <span className="thinking-tool__arg-sep" aria-hidden="true">
            →
          </span>
          <VisuallyHidden>to </VisuallyHidden>
          <span className="thinking-tool__arg-value">{journey.to}</span>
        </span>
      )}
      {date && (
        <>
          {journey && (
            <span className="thinking-tool__arg-sep" aria-hidden="true">
              ·
            </span>
          )}
          <span className="thinking-tool__arg-value">{date}</span>
        </>
      )}
      {chips.map((chip) => (
        <span className="thinking-tool__arg-chip" key={chip.key}>
          <span className="thinking-tool__arg-key">{chip.key}</span>
          <span className="thinking-tool__arg-value">{chip.value}</span>
        </span>
      ))}
    </p>
  );
}

/**
 * A result row's leading icon: the site's own favicon when the provider gave a
 * web page for the row, else the category glyph. The image is decorative, so a
 * host that serves no icon — or a blocked request — falls back to the glyph
 * rather than leaving a gap.
 */
function ResultRowIcon({ row, kind }: { row: ToolResultRow; kind: ToolResultKind }) {
  const [failed, setFailed] = useState(false);
  const host = resultHost(row);
  if (host && !failed) {
    return (
      <span className="thinking-tool__row-icon" data-kind={kind} data-site={host} aria-hidden="true">
        {/* A 14px third-party icon: next/image would need the icon host in
            remotePatterns and would proxy the request this component
            deliberately sends without a referrer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="thinking-tool__row-favicon"
          src={faviconSrc(host)}
          alt=""
          width={14}
          height={14}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span className="thinking-tool__row-icon" data-kind={kind} aria-hidden="true">
      <ResultKindIcon kind={kind} />
    </span>
  );
}

const TOOL_STATE_LABEL = { running: "running", completed: "completed", failed: "failed" } as const;

export function ToolRow({ row, open }: { row: ToolRowModel; open: OpenRows }) {
  const id = `tool:${row.started.callId}`;
  const hasArgs = Boolean(row.args && Object.keys(row.args).length > 0);
  // Arguments and result rows are the only detail a tool row has; without
  // either it stays a plain row.
  const expandable = hasArgs || Boolean(row.resultRows?.length);
  const tool = row.started.tool;
  return (
    <div role="group" aria-label={`${row.started.label} ${TOOL_STATE_LABEL[row.state]}`}>
      <Disclosure
        className={cn("thinking-tool", `thinking-tool--${row.state}`)}
        // The icon says what the call is; a failure swaps it for the error dot.
        icon={row.state === "failed" ? <StatusDot state="failed" /> : <ToolGlyph tool={tool} />}
        title={row.started.label}
        state={row.state === "running" ? "running" : row.state === "failed" ? "error" : "ok"}
        open={open.isOpen(id)}
        expandable={expandable}
        keepContentWhenOpen
        onToggle={() => open.toggle(id)}
        collapsedContent={
          <>
            <RowSeparator />
            <RowSummary text={row.summary} {...(row.state === "failed" ? { tone: "error" as const } : {})} />
          </>
        }
      >
        <Children>
          <div className="thinking-tool__body">
            {hasArgs && row.args && <ToolArgs args={row.args} />}
            {row.resultRows && row.resultRows.length > 0 && (
              <ul className="thinking-tool__rows">
                {row.resultRows.map((item, index) => {
                  const kind = resultKind(item, tool);
                  return (
                    <li className="thinking-tool__row" key={`${item.label}-${index}`}>
                      <ResultRowIcon row={item} kind={kind} />
                      <span className="thinking-tool__row-label">{item.label}</span>
                      {item.detail && <span className="thinking-tool__row-detail">{item.detail}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {row.resultTruncated && (
              <p className="thinking-tool__truncated">
                {`Showing the first ${row.resultRows?.length ?? 0} of ${row.resultCount ?? row.resultRows?.length ?? 0}`}
              </p>
            )}
          </div>
        </Children>
      </Disclosure>
    </div>
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
          <FlowCheckIcon />
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
              <FlowChevronDownIcon />
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

/** What the coordinator asked of the subagent and what it produced. */
function SubagentNotes({ model, open }: { model: SubagentModel; open: OpenRows }) {
  const hasNotes = Boolean(
    model.objective ||
      model.constraints ||
      model.outcome ||
      model.error ||
      model.choice ||
      model.coordinator,
  );
  if (!hasNotes) return null;
  const choiceId = `choice:${model.round}:${model.name}`;
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
      {model.objective && <p className="thinking-note__summary">{`Asked for: ${model.objective}`}</p>}
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
          expanded={open.isOpen(choiceId)}
          onToggle={() => open.toggle(choiceId)}
        />
      )}
    </div>
  );
}

/** `Subagent · <name> · <summary>` and, when open, its notes, thinking and tool calls. */
export function SubagentRow({ model, open }: { model: SubagentModel; open: OpenRows }) {
  const label = labels[model.name];
  const running = model.status === "running" || model.status === "revising";
  return (
    <div
      className={cn("thinking-subagent", `thinking-subagent--${model.status}`)}
      data-status={model.status}
      role="listitem"
      aria-label={`${label} ${statusLabels[model.status]}`}
    >
      <Disclosure
        className="thinking-subagent__row"
        icon={<FlowSubagentIcon />}
        title="Subagent"
        state={running ? "running" : model.status === "failed" ? "error" : "ok"}
        open={open.isOpen(model.id)}
        expandable={subagentHasBody(model)}
        keepContentWhenOpen
        onToggle={() => open.toggle(model.id)}
        collapsedContent={
          <>
            <RowSeparator />
            <span className="thinking-row__name">{label}</span>
            <RowSeparator />
            <RowSummary
              text={model.summary}
              followEnd={model.streaming}
              {...(model.status === "failed" ? { tone: "error" as const } : {})}
            />
            <span className="thinking-subagent__status">
              <StatusDot state={dotState(model.status)} />
              <VisuallyHidden>{statusLabels[model.status]}</VisuallyHidden>
            </span>
          </>
        }
      >
        <Children>
          <SubagentNotes model={model} open={open} />
          {model.steps.map((step) =>
            step.kind === "reasoning" ? (
              <ReasoningRow key={step.block.id} block={step.block} open={open} />
            ) : (
              <ToolRow key={step.row.started.callId} row={step.row} open={open} />
            ),
          )}
        </Children>
      </Disclosure>
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

/** DSH's running-text treatment (TextShimmer.tsx): the shimmer band's width scales with the label. */
const RUNNING_LABEL = "Deep diving";

export function RunningLine({ elapsedMs }: { elapsedMs: number }) {
  const showClock = elapsedMs >= CLOCK_DELAY_MS;
  return (
    <p className="thinking-running" role="status" aria-live="polite">
      <span
        className="thinking-running__label"
        data-text-shimmer
        style={{ "--thinking-text-shimmer-spread": `${RUNNING_LABEL.length * 8}px` } as CSSProperties}
      >
        {RUNNING_LABEL}
      </span>
      {showClock && (
        <span className="thinking-running__clock" aria-hidden="true">
          {`${Math.floor(elapsedMs / 1000)}s`}
        </span>
      )}
    </p>
  );
}
