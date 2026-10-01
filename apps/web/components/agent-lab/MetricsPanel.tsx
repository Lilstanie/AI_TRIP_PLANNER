import type { AgentLabCompletedRunArtifact } from "@trip/shared";
import { money } from "@/lib/agent-lab/format";

export function MetricsList({ artifact }: { artifact: AgentLabCompletedRunArtifact }) {
  const { metrics } = artifact;
  const passed = metrics.checks.filter((check) => check.passed).length;
  return (
    <>
      <dl className="agent-lab__metrics">
        <div>
          <dt>Budget</dt>
          <dd>{metrics.withinBudget ? "Within budget" : "Over budget"}</dd>
          <small>
            {metrics.withinBudget
              ? `${money(metrics.budgetHeadroom)} remaining`
              : `${money(-metrics.budgetHeadroom)} over`}
          </small>
        </div>
        <div>
          <dt>Checks</dt>
          <dd>
            {passed}/{metrics.checks.length} passed
          </dd>
          <small>Deterministic checks</small>
        </div>
        <div>
          <dt>Sections</dt>
          <dd>{metrics.sectionCount}</dd>
          <small>Validated plan sections</small>
        </div>
        <div>
          <dt>Trace</dt>
          <dd>{metrics.eventCount} events</dd>
          <small>{metrics.durationMs} ms recorded</small>
        </div>
      </dl>
      <ul className="agent-lab__checks" aria-label="Deterministic checks">
        {metrics.checks.map((check) => (
          <li key={check.id} data-agent-lab-check={check.id} data-passed={check.passed}>
            <span>{check.passed ? "Passed" : "Failed"}</span>
            {check.label}
          </li>
        ))}
      </ul>
    </>
  );
}
