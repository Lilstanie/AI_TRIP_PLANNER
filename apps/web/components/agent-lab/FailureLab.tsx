import { stopReasonLabel } from "@/lib/agent-lab/comparison";
import { faultOutcome } from "@/lib/agent-lab/fault-outcome";
import {
  emptyRun,
  faultKey,
  type FaultProfileSummary,
  type RunView,
} from "@/lib/agent-lab/run-view";
import { DownloadArtifactButton } from "./DownloadArtifactButton";
import { MetricsList } from "./MetricsPanel";
import { RunTimeline } from "./RunTimeline";

interface FailureLabProps {
  profiles: readonly FaultProfileSummary[];
  scenarioTitle: (id: FaultProfileSummary["scenarioId"]) => string;
  strategyLabel: (id: FaultProfileSummary["strategyId"]) => string;
  runs: Record<string, RunView>;
  locked: boolean;
  onRun: (id: FaultProfileSummary["id"]) => void;
  onRunAll: () => void;
  onDownloaded: (filename: string) => void;
}

const expectedCopy = {
  degraded: "the run carries on with less",
  partial: "the run keeps a partial result",
  terminal: "the run stops",
} as const;

const where = (capability: string) =>
  capability === "supervisor"
    ? "the supervisor"
    : `the ${capability.replace(/-/g, " ")} specialist`;

const figureRows = (figures: ReturnType<typeof faultOutcome>["figures"]) =>
  [
    ["Events", String(figures.events)],
    ["Failed tool calls", String(figures.toolFailures)],
    ["Failed specialists", String(figures.failedAgents)],
    ["Unavailable sections", String(figures.unavailableSections)],
    [
      "Unresolved conflicts",
      figures.unresolvedConflicts === null ? "Not applicable" : String(figures.unresolvedConflicts),
    ],
    [
      "Stopping reason",
      figures.stopReason === null
        ? "Not applicable"
        : figures.stopReason === "none"
          ? "No loop"
          : stopReasonLabel(figures.stopReason as Parameters<typeof stopReasonLabel>[0]),
    ],
  ] as const;

/**
 * The registered faults, each run on its own scenario and strategy. A card says where the fault is
 * injected and, once it has run, how the workflow met it: it carried on with less, kept a partial result
 * or stopped. Everything shown is read from the run's artifact, so a live run, a download and a replay of
 * it read the same.
 */
export function FailureLab({
  profiles,
  scenarioTitle,
  strategyLabel,
  runs,
  locked,
  onRun,
  onRunAll,
  onDownloaded,
}: FailureLabProps) {
  return (
    <section
      className="agent-lab__failures"
      aria-labelledby="agent-lab-failures-title"
      data-agent-lab-failures
    >
      <div className="agent-lab__panel-heading">
        <div>
          <p className="agent-lab__kicker">Failure lab</p>
          <h2 id="agent-lab-failures-title">Controlled failures</h2>
        </div>
        <button className="agent-lab__secondary" type="button" onClick={onRunAll} disabled={locked}>
          Run all fault profiles
        </button>
      </div>
      <p className="agent-lab__failures-intro">
        Each profile injects one registered, deterministic fault into the same workflow the other
        views run, on its own scenario and strategy. You choose a profile and never define a fault.
        The card shows where it was injected and whether the workflow carried on with less, kept a
        partial result or stopped.
      </p>
      <div className="agent-lab__fault-list">
        {profiles.map((profile) => {
          const run = runs[faultKey(profile.id)] ?? emptyRun();
          const recorded = run.artifact ?? run.failure;
          const outcome = recorded && run.state !== "running" ? faultOutcome(recorded) : undefined;
          return (
            <article
              key={profile.id}
              className="agent-lab__fault"
              data-agent-lab-fault={profile.id}
              aria-labelledby={`fault-${profile.id}-title`}
            >
              <h3 id={`fault-${profile.id}-title`}>{profile.title}</h3>
              <p>{profile.summary}</p>
              <dl className="agent-lab__fault-meta">
                <div>
                  <dt>Injected into</dt>
                  <dd>{where(profile.capability)}</dd>
                </div>
                <div>
                  <dt>Runs on</dt>
                  <dd>
                    {scenarioTitle(profile.scenarioId)} · {strategyLabel(profile.strategyId)}
                  </dd>
                </div>
                <div>
                  <dt>Expected</dt>
                  <dd>{expectedCopy[profile.expected]}</dd>
                </div>
              </dl>
              <div className="agent-lab__fault-actions">
                <button
                  className="agent-lab__secondary"
                  type="button"
                  aria-label={`Run fault profile: ${profile.title}`}
                  onClick={() => onRun(profile.id)}
                  disabled={locked}
                >
                  Run profile
                </button>
                {recorded && run.state !== "running" ? (
                  <DownloadArtifactButton
                    artifact={recorded}
                    label={profile.title}
                    onDownloaded={onDownloaded}
                  />
                ) : null}
              </div>
              {run.state === "running" ? (
                <p className="agent-lab__fault-running">
                  {run.replay ? "Replaying" : "Running"} · {run.events.length} events
                </p>
              ) : null}
              {run.replay ? (
                <p className="agent-lab__replay-note" data-agent-lab-replay-note>
                  Replay of recorded run <code>{run.replay.runId}</code> from {run.replay.startedAt}
                  . Nothing is run again: events appear at their recorded times.
                </p>
              ) : null}
              {outcome ? (
                <div className="agent-lab__fault-result">
                  <p
                    className="agent-lab__outcome"
                    data-agent-lab-fault-outcome
                    data-outcome={outcome.kind}
                  >
                    {outcome.label}
                  </p>
                  <p className="agent-lab__fault-headline" data-agent-lab-fault-headline>
                    {outcome.headline}
                  </p>
                  {outcome.facts.length ? (
                    <ul className="agent-lab__fault-facts" data-agent-lab-fault-facts>
                      {outcome.facts.map((fact) => (
                        <li key={fact}>{fact}</li>
                      ))}
                    </ul>
                  ) : null}
                  <dl className="agent-lab__fault-figures" data-agent-lab-fault-figures>
                    {figureRows(outcome.figures).map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <details>
                    <summary>Trace ({run.events.length} events)</summary>
                    <RunTimeline events={run.events} label={`${profile.title} run events`} />
                  </details>
                  {run.artifact ? (
                    <details>
                      <summary>Run metrics</summary>
                      <MetricsList artifact={run.artifact} />
                    </details>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
