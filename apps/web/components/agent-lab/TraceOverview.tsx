"use client";

import { useMemo } from "react";
import type { AgentLabRunEvent } from "@trip/shared";
import { deriveTraceOverview } from "@/lib/agent-lab/trace-overview";

export function TraceOverview({
  events,
  onSelect,
  domainSteps,
  label = "Trace overview",
  blockPrefix,
}: {
  blockPrefix?: string;
  events: readonly AgentLabRunEvent[];

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
                aria-label={`${blockPrefix ? `${blockPrefix}, ` : ""}${lane.label}, ${record.title}, step ${record.step}${
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
