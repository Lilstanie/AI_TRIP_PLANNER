import type { AgentLabCompletedRunArtifact, AgentLabRunEvent } from "@trip/shared";
import { buildComparisonRows, NO_RESULT } from "@/lib/agent-lab/comparison";
import { PlanSections, PlanSummary } from "./PlanSections";
import { RunTimeline } from "./RunTimeline";

export interface ComparisonSide {
  label: string;
  events: readonly AgentLabRunEvent[];
  artifact?: AgentLabCompletedRunArtifact;
}

/**
 * Both strategies side by side. Figures come from each run's artifact, and the panel never ranks the
 * strategies: it measures what specialization changed, not which side "wins".
 */
export function ComparisonPanel({
  single,
  multi,
}: {
  single: ComparisonSide;
  multi: ComparisonSide;
}) {
  const rows = buildComparisonRows(single.artifact, multi.artifact);
  const sides = [single, multi] as const;
  return (
    <section className="agent-lab__compare" aria-labelledby="agent-lab-compare-title">
      <div className="agent-lab__panel-heading">
        <div>
          <p className="agent-lab__kicker">Comparison</p>
          <h2 id="agent-lab-compare-title">Single agent and five specialists</h2>
        </div>
      </div>
      <p className="agent-lab__compare-note" data-agent-lab-compare-note>
        This comparison measures specialization only. The five-specialist run plays one round and
        never revises, so none of the difference comes from targeted revision.
      </p>
      <div className="agent-lab__table-wrap">
        <table className="agent-lab__table">
          <caption>Measured figures for each strategy</caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">{single.label}</th>
              <th scope="col">{multi.label}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-agent-lab-compare-row={row.id}>
                <th scope="row">{row.label}</th>
                {row.values.map((value, index) => (
                  <td key={sides[index].label} data-not-run={value === NO_RESULT}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="agent-lab__compare-columns">
        {sides.map((side) => (
          <article key={side.label} aria-label={side.label} data-agent-lab-compare-side>
            <h3>{side.label}</h3>
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
