import type { AgentLabCompletedRunArtifact } from "@trip/shared";
import { multiCityLabel, stopReasonLabel, usageLabel } from "@/lib/agent-lab/comparison";
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
        <div>
          <dt>Grounding</dt>
          <dd>
            {metrics.groundedSections}/{metrics.sectionCount} sections
          </dd>
          <small>Built from provider or fixture evidence</small>
        </div>
        <div>
          <dt>Stops</dt>
          <dd>{metrics.duplicateStops} repeated</dd>
          <small>{metrics.genericStops} generic</small>
        </div>
        <div>
          <dt>Planning loop</dt>
          <dd>{stopReasonLabel(metrics.stopReason)}</dd>
          <small>
            {metrics.rounds} {metrics.rounds === 1 ? "round" : "rounds"} · multi-city{" "}
            {multiCityLabel(metrics.multiCityConsistent).toLowerCase()}
          </small>
        </div>
        <div>
          <dt>Token and model cost</dt>
          <dd>{usageLabel(metrics.usage)}</dd>
          <small>
            {metrics.usage.status === "unavailable"
              ? metrics.usage.reason
              : `${metrics.usage.inputTokens.toLocaleString("en-AU")} in, ${metrics.usage.outputTokens.toLocaleString("en-AU")} out; reported by the provider`}
          </small>
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
