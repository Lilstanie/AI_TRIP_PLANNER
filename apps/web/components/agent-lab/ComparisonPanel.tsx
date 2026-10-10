"use client";

import { useMemo, useRef } from "react";
import type { AgentLabCompletedRunArtifact, AgentLabRunEvent } from "@trip/shared";
import { buildComparisonRows, NO_RESULT } from "@/lib/agent-lab/comparison";
import { faultOutcome } from "@/lib/agent-lab/fault-outcome";
import { deriveTraceOverview } from "@/lib/agent-lab/trace-overview";
import { DownloadArtifactButton } from "./DownloadArtifactButton";
import { OutcomeBadge } from "./OutcomeBadge";
import { PlanSections, PlanSummary } from "./PlanSections";
import { RunTimeline } from "./RunTimeline";
import { TraceOverview } from "./TraceOverview";

export interface ComparisonSide {
  label: string;
  events: readonly AgentLabRunEvent[];
  artifact?: AgentLabCompletedRunArtifact;
}

export function ComparisonPanel({
  sides,
  provenance,
  onDownloaded,
}: {
  sides: readonly ComparisonSide[];

  provenance: string;
  onDownloaded: (filename: string) => void;
}) {
  const rows = buildComparisonRows(...sides.map((side) => side.artifact));

  const jumps = useRef<(((sequence: number) => void) | null)[]>([]);
  const registrars = useMemo(
    () =>
      Array.from(
        { length: sides.length },
        (_, index) => (jump: ((sequence: number) => void) | null) => {
          jumps.current[index] = jump;
        },
      ),
    [sides.length],
  );

  const domainSteps = Math.max(
    1,
    ...sides.map((side) => deriveTraceOverview(side.events).records.length),
  );
  return (
    <section className="agent-lab__compare" aria-labelledby="agent-lab-compare-title">
      <div className="agent-lab__panel-heading">
        <div>
          <p className="agent-lab__kicker">Comparison</p>
          <h2 id="agent-lab-compare-title">Three strategies, one scenario</h2>
        </div>
        <span data-agent-lab-provenance>{provenance}</span>
      </div>
      <div className="agent-lab__compare-note" data-agent-lab-compare-note>
        <p>
          Single agent against five specialists with no revision measures specialization only: the
          specialist run plays one round and never revises.
        </p>
        <p>
          Five specialists with no revision against targeted revision measures what targeted
          revision adds: the two share the same evidence and the same first round, and differ only
          in whether the conflicts that round finds may be revised.
        </p>
      </div>
      <div className="agent-lab__table-wrap">
        <table className="agent-lab__table">
          <caption>Measured figures for each strategy</caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              {sides.map((side) => (
                <th scope="col" key={side.label}>
                  {side.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-agent-lab-compare-row={row.id}>
                <th scope="row">{row.label}</th>
                {row.values.map((value, index) => (
                  <td key={sides[index]!.label} data-not-run={value === NO_RESULT}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sides.some((side) => side.events.length) ? (
        <div className="agent-lab__compare-bars" data-trace-compare-bars>
          {sides.map((side, index) =>
            side.events.length ? (
              <div key={side.label} className="agent-lab__compare-bar">
                <h3>{side.label}</h3>
                <TraceOverview
                  events={side.events}
                  domainSteps={domainSteps}
                  label={`${side.label} trace overview`}
                  blockPrefix={side.label}
                  onSelect={(sequence) => jumps.current[index]?.(sequence)}
                />
              </div>
            ) : null,
          )}
        </div>
      ) : null}
      <div className="agent-lab__compare-columns" data-sides={sides.length}>
        {sides.map((side, index) => (
          <article key={side.label} aria-label={side.label} data-agent-lab-compare-side>
            <h3>{side.label}</h3>
            {side.artifact ? <OutcomeBadge outcome={faultOutcome(side.artifact)} /> : null}
            {side.artifact ? (
              <DownloadArtifactButton
                artifact={side.artifact}
                label={side.label}
                onDownloaded={onDownloaded}
              />
            ) : null}
            {side.artifact ? (
              <>
                <PlanSummary plan={side.artifact.plan} />
                <PlanSections plan={side.artifact.plan} />
              </>
            ) : (
              <p className="agent-lab__compare-empty">{NO_RESULT}</p>
            )}
            {side.events.length ? (
              <RunTimeline
                events={side.events}
                label={`${side.label} run events`}
                showOverview={false}
                onJumpReady={registrars[index]}
              />
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
