"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentProgressEvent } from "@trip/shared";
import { FlowThinkIcon } from "../ui/flow-icons";
import { Disclosure, RowSeparator, RowSummary } from "./Disclosure";
import { countActivity, roundGroups, turnSummary } from "./thinking-model";
import {
  Children,
  RoundHeading,
  RunningLine,
  SubagentRow,
  type OpenRows,
} from "./ThinkingRows";

// ---------------------------------------------------------------------------
// The thinking transcript is a DSH-style tree of 24px disclosure rows:
//   Think (the turn) → Subagent · <name> per round → that subagent's Think
//   (reasoning) and tool rows → a tool's arguments and result rows.
// Every row starts collapsed, busy or settled, and a click opens only that
// row. This file owns the turn row and the open set; thinking-model derives
// the tree from `activity`, and ThinkingRows renders the rows below the turn.
// ---------------------------------------------------------------------------

/** A plain set of open row ids. Nothing is open until the reader opens it. */
function useOpenRows(): OpenRows {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback((id: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  return useMemo(() => ({ isOpen: (id: string) => open.has(id), toggle }), [open, toggle]);
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

export function ThinkingProcess({
  activity,
  busy,
  error,
}: {
  activity: AgentProgressEvent[];
  busy: boolean;
  error?: string;
}) {
  const open = useOpenRows();
  const elapsed = useElapsedMs(busy);
  const counts = useMemo(() => countActivity(activity), [activity]);
  const groups = useMemo(() => roundGroups(activity, busy), [activity, busy]);
  const summary = useMemo(
    () => turnSummary(activity, counts, busy, error),
    [activity, counts, busy, error],
  );
  const multiRound = groups.length > 1;
  const failed = !busy && Boolean(error);

  return (
    <div className="thinking-process">
      <Disclosure
        className="thinking-turn"
        icon={<FlowThinkIcon />}
        title="Think"
        state={busy ? "running" : failed ? "error" : "ok"}
        open={open.isOpen("turn")}
        expandable
        keepContentWhenOpen
        onToggle={() => open.toggle("turn")}
        collapsedContent={
          <>
            <RowSeparator />
            <RowSummary text={summary.text} followEnd={summary.streaming} />
          </>
        }
      >
        <Children>
          {groups.map((group) => (
            <div className="thinking-round-group" key={`round-${group.round}`}>
              {multiRound && group.heading && (
                <RoundHeading
                  round={group.round}
                  summary={group.heading.summary}
                  {...(group.heading.constraints ? { constraints: group.heading.constraints } : {})}
                />
              )}
              <div
                className="thinking-subagents"
                role="list"
                aria-label="Subagents thinking together"
              >
                {group.subagents.map((model) => (
                  <SubagentRow key={model.id} model={model} open={open} />
                ))}
              </div>
            </div>
          ))}
          {failed && <p className="thinking-error">{error}</p>}
        </Children>
      </Disclosure>
      {/* Exactly one live line for the whole turn, only while it is in flight. */}
      {busy && <RunningLine elapsedMs={elapsed} />}
    </div>
  );
}
