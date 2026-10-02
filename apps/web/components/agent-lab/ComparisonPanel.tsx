import type { AgentLabCompletedRunArtifact, AgentLabRunEvent } from "@trip/shared";
import { buildComparisonRows, NO_RESULT } from "@/lib/agent-lab/comparison";
import { DownloadArtifactButton } from "./DownloadArtifactButton";
import { PlanSections, PlanSummary } from "./PlanSections";
import { RunTimeline } from "./RunTimeline";

export interface ComparisonSide {
  label: string;
  events: readonly AgentLabRunEvent[];
  artifact?: AgentLabCompletedRunArtifact;
}

/**
 * The strategies side by side, in the order they build on each other. Figures come from each run's
 * artifact, and the panel never ranks the strategies: it shows what each step adds, not which side
 * "wins".
 */
export function ComparisonPanel({
  sides,
  onDownloaded,
}: {
  sides: readonly ComparisonSide[];
  onDownloaded: (filename: string) => void;
}) {
  const rows = buildComparisonRows(...sides.map((side) => side.artifact));
  return (
    <section className="agent-lab__compare" aria-labelledby="agent-lab-compare-title">
      <div className="agent-lab__panel-heading">
        <div>
          <p className="agent-lab__kicker">Comparison</p>
          <h2 id="agent-lab-compare-title">Three strategies, one scenario</h2>
        </div>
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
      <div className="agent-lab__compare-columns" data-sides={sides.length}>
        {sides.map((side) => (
          <article key={side.label} aria-label={side.label} data-agent-lab-compare-side>
            <h3>{side.label}</h3>
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
              <RunTimeline events={side.events} label={`${side.label} run events`} />
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
