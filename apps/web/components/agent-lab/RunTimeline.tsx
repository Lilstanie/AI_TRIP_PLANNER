"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type WheelEvent } from "react";
import type { AgentLabRunEvent } from "@trip/shared";
import { eventCopy, eventKindLabel } from "@/lib/agent-lab/event-copy";
import { TraceOverview } from "./TraceOverview";

/** Distance from the bottom, in px, that still counts as "at the bottom" (fractional scroll positions). */
const BOTTOM_TOLERANCE = 8;

/**
 * The ordered trace of one run, with each event labelled by the part of the system that produced it.
 * The list scrolls inside its own bounded box. The box follows the newest event while it sits at the
 * bottom; scrolling up suspends following, and returning to the bottom resumes it. The follow scroll is
 * always instant: a smooth animation would fire scroll events away from the bottom and suspend itself,
 * and it would ignore a visitor's reduced-motion setting.
 */
export function RunTimeline({
  events,
  label,
}: {
  events: readonly AgentLabRunEvent[];
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const seen = useRef(0);

  const onScroll = useCallback(() => {
    const el = box.current;
    if (!el) return;
    following.current = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_TOLERANCE;
  }, []);

  // A wheel up is intent to read earlier events; do not wait for the scroll event to say so.
  const onWheel = useCallback((event: WheelEvent) => {
    if (event.deltaY < 0) following.current = false;
  }, []);

  // Bring a row into the box and mark it for a moment. The scroll is instant under reduced motion. Either
  // way it leaves the bottom, so following suspends until the visitor returns there.
  const highlightTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(highlightTimer.current), []);
  const jumpTo = useCallback((sequence: number) => {
    const el = box.current;
    const row = el?.querySelector<HTMLElement>(`[data-trace-row="${sequence}"]`);
    if (!el || !row) return;
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

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    // A shorter list is a new run (or a replay restarting): follow it from its first event.
    if (events.length < seen.current) following.current = true;
    seen.current = events.length;
    if (following.current) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const list = (
    // Focusable so a keyboard user can scroll the box with the arrow keys.
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
          return (
            <li
              key={`${runEvent.runId}-${runEvent.sequence}`}
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
          );
        })}
      </ol>
    </div>
  );

  return (
    <>
      <TraceOverview events={events} onSelect={jumpTo} />
      {list}
    </>
  );
}
