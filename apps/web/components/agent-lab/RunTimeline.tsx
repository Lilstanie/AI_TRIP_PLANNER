"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type WheelEvent,
} from "react";
import type { AgentLabRunEvent } from "@trip/shared";
import { eventCopy, eventKindLabel } from "@/lib/agent-lab/event-copy";
import { TraceOverview } from "./TraceOverview";

const BOTTOM_TOLERANCE = 8;

const roundOf = (runEvent: AgentLabRunEvent): number | undefined =>
  "round" in runEvent.event ? runEvent.event.round : undefined;

export function RunTimeline({
  events,
  label,
  showOverview = true,
  onJumpReady,
}: {
  events: readonly AgentLabRunEvent[];
  label: string;

  showOverview?: boolean;

  onJumpReady?: (jump: ((sequence: number) => void) | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const seen = useRef(0);
  const [roundsFolded, setRoundsFolded] = useState(false);
  const [callsFolded, setCallsFolded] = useState(false);

  const onScroll = useCallback(() => {
    const el = box.current;
    if (!el) return;
    following.current = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_TOLERANCE;
  }, []);

  const onWheel = useCallback((event: WheelEvent) => {
    if (event.deltaY < 0) following.current = false;
  }, []);

  const highlightTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(highlightTimer.current), []);
  const [pendingJump, setPendingJump] = useState<number | null>(null);
  const jumpTo = useCallback((sequence: number) => {
    const el = box.current;
    const row = el?.querySelector<HTMLElement>(`[data-trace-row="${sequence}"]`);
    if (!el) return;
    if (!row) {
      setRoundsFolded(false);
      setCallsFolded(false);
      setPendingJump(sequence);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    following.current = false;
    el.scrollTo({
      top: el.scrollTop + row.getBoundingClientRect().top - el.getBoundingClientRect().top,
      behavior: reduced ? "auto" : "smooth",
    });
    el.querySelectorAll("[data-trace-highlight]").forEach((n) =>
      n.removeAttribute("data-trace-highlight"),
    );
    row.setAttribute("data-trace-highlight", "");
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(
      () => row.removeAttribute("data-trace-highlight"),
      1800,
    );
  }, []);

  useEffect(() => {
    if (pendingJump === null) return;
    setPendingJump(null);

    if (box.current?.querySelector(`[data-trace-row="${pendingJump}"]`)) jumpTo(pendingJump);
  }, [pendingJump, jumpTo]);

  useEffect(() => {
    onJumpReady?.(jumpTo);
    return () => onJumpReady?.(null);
  }, [onJumpReady, jumpTo]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;

    if (events.length < seen.current) following.current = true;
    seen.current = events.length;
    if (following.current) el.scrollTop = el.scrollHeight;
  }, [events.length, roundsFolded, callsFolded]);

  const roundSizes = new Map<number, number>();
  for (const runEvent of events) {
    const round = roundOf(runEvent);
    if (round !== undefined) roundSizes.set(round, (roundSizes.get(round) ?? 0) + 1);
  }
  let headed: number | undefined;

  return (
    <>
      {showOverview ? <TraceOverview events={events} onSelect={jumpTo} /> : null}
      <div className="agent-lab__trace-toolbar" role="group" aria-label="Trace folds">
        <button
          type="button"
          data-agent-lab-fold="rounds"
          aria-pressed={roundsFolded}
          onClick={() => setRoundsFolded((folded) => !folded)}
        >
          Fold rounds
        </button>
        <button
          type="button"
          data-agent-lab-fold="calls"
          aria-pressed={callsFolded}
          onClick={() => setCallsFolded((folded) => !folded)}
        >
          Fold calls
        </button>
      </div>

      <div
        className="agent-lab__trace-box"
        data-agent-lab-trace-box
        ref={box}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={onScroll}
        onWheel={onWheel}
      >
        <ol className="agent-lab__timeline">
          {events.map((runEvent) => {
            const copy = eventCopy(runEvent);
            const round = roundOf(runEvent);
            const heading = round !== undefined && round !== headed ? round : undefined;
            if (round !== undefined) headed = round;
            const hidden =
              (roundsFolded && round !== undefined) || (callsFolded && copy.kind === "tool");
            return (
              <Fragment key={`${runEvent.runId}-${runEvent.sequence}`}>
                {heading !== undefined ? (
                  <li className="agent-lab__round-heading" data-agent-lab-round={heading}>
                    Round {heading} · {roundSizes.get(heading)}{" "}
                    {roundSizes.get(heading) === 1 ? "event" : "events"}
                  </li>
                ) : null}
                {hidden ? null : (
                  <li
                    data-agent-lab-event
                    data-trace-row={runEvent.sequence}
                    data-event-kind={copy.kind}
                  >
                    <span className="agent-lab__sequence">{runEvent.sequence}</span>
                    <div>
                      <span className="agent-lab__kind" data-kind={copy.kind}>
                        {eventKindLabel[copy.kind]}
                      </span>
                      <strong>{copy.title}</strong>
                      <p>{copy.detail}</p>
                      {copy.constraints ? (
                        <div className="agent-lab__list">
                          <span>Constraints</span>
                          <ul className="agent-lab__constraints" aria-label="Constraints">
                            {copy.constraints.map((constraint) => (
                              <li key={constraint}>{constraint}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {copy.list ? (
                        <div className="agent-lab__list">
                          <span>{copy.list.heading}</span>
                          <ul className="agent-lab__constraints" aria-label={copy.list.heading}>
                            {copy.list.lines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <small>+{runEvent.elapsedMs} ms</small>
                    </div>
                  </li>
                )}
              </Fragment>
            );
          })}
        </ol>
      </div>
    </>
  );
}
