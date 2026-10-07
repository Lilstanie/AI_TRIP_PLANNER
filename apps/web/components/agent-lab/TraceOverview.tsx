"use client";

import { useMemo } from "react";
import type { AgentLabRunEvent } from "@trip/shared";
import { deriveTraceOverview } from "@/lib/agent-lab/trace-overview";

/**
 * The Trace view's time bar: one lane per actor, one equal-width slot per record. It is a pure view of the
 * events it is given, so it grows as they stream and when an artifact replays. `domainSteps` lets a caller
 * stretch the axis to a longer run so bars stacked in the Compare view share one step scale.
 */
export function TraceOverview({
  events,
  onSelect,
  domainSteps,
  label = "Trace overview",
}: {
  events: readonly AgentLabRunEvent[];
  /** Asked to bring the list row with this sequence into view. */
  onSelect?: (sequence: number) => void;
  domainSteps?: number;
  label?: string;
}) {
  const overview = useMemo(() => deriveTraceOverview(events), [events]);
  const steps = Math.max(domainSteps ?? 0, overview.records.length, 1);
  if (!overview.records.length) return null;

  return (
    <div
      className="agent-lab__trace-overview"
      data-trace-overview
      role="group"
      aria-label={label}
      style={{ "--trace-steps": steps } as React.CSSProperties}
    >
      {overview.boundaries.length ? (
        <div className="agent-lab__trace-lane agent-lab__trace-axis" aria-hidden="true">
          <span className="agent-lab__trace-lane-label" />
          <div className="agent-lab__trace-track">
            {overview.boundaries.map((boundary) => (
              <span
                key={boundary.round}
                className="agent-lab__trace-round-tag"
                style={{ left: `${((boundary.step - 1) / steps) * 100}%` }}
              >
                R{boundary.round}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {overview.lanes.map((lane) => (
        <div
          key={lane.id}
          className="agent-lab__trace-lane"
          data-trace-lane={lane.label}
          role="group"
          aria-label={`${lane.label} lane`}
        >
          <span className="agent-lab__trace-lane-label" data-trace-lane-label aria-hidden="true">
            <span className="agent-lab__trace-lane-full">{lane.label}</span>
            <span className="agent-lab__trace-lane-short">{lane.short}</span>
          </span>
          <div className="agent-lab__trace-track">
            {overview.boundaries.map((boundary) => (
              <span
                key={boundary.round}
                className="agent-lab__trace-round-line"
                data-trace-round-boundary={boundary.round}
                aria-hidden="true"
                style={{ left: `${((boundary.step - 1) / steps) * 100}%` }}
              />
            ))}
            {lane.records.map((record) => (
              <button
                key={record.step}
                type="button"
                className="agent-lab__trace-block"
                data-trace-block
                data-step={record.step}
                data-sequence={record.sequence}
                data-kind={record.kind}
                data-round={record.round}
                data-error={record.error}
                data-in-flight={record.inFlight}
                style={{ gridColumn: record.step }}
                aria-label={`${lane.label}, ${record.title}, step ${record.step}${
                  record.error ? ", failed" : record.inFlight ? ", in progress" : ""
                }`}
                onClick={() => onSelect?.(record.sequence)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
