"use client";

import {
  type AgentLabFaultProfileId,
  type AgentLabRunRequest,
  type AgentLabScenarioId,
  type AgentLabStrategyId,
} from "@trip/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { faultOutcome } from "@/lib/agent-lab/fault-outcome";
import { AgentLabRunError, readAgentLabStream } from "@/lib/agent-lab/stream";
import { money } from "@/lib/agent-lab/format";
import { readReplayFile, replayEvents } from "@/lib/agent-lab/replay";
import {
  emptyRun,
  faultKey,
  type FaultProfileSummary,
  type RunState,
  type RunView,
} from "@/lib/agent-lab/run-view";
import { ComparisonPanel } from "./ComparisonPanel";
import { DesignNotes } from "./DesignNotes";
import { DownloadArtifactButton } from "./DownloadArtifactButton";
import { FailureLab } from "./FailureLab";
import { MetricsList } from "./MetricsPanel";
import { PlanSections, PlanSummary } from "./PlanSections";
import { RunTimeline } from "./RunTimeline";

interface ScenarioSummary {
  id: AgentLabScenarioId;
  title: string;
  summary: string;
}

interface StrategySummary {
  id: AgentLabStrategyId;
  label: string;
}

interface AgentLabClientProps {
  scenarios: readonly ScenarioSummary[];
  strategies: readonly StrategySummary[];
  faultProfiles: readonly FaultProfileSummary[];
}

type View = "inspect" | "compare" | "failures";

/** One request the page makes, and the key its result is kept under. */
interface Job {
  key: string;
  body: AgentLabRunRequest;
  /** Set for a fault run, where the run stopping is the outcome being shown, not a failure of the page. */
  profile?: FaultProfileSummary;
}

const statusCopy: Record<RunState, string> = {
  ready: "Ready",
  running: "Running fixture experiment",
  cancelled: "Run cancelled",
  complete: "Run complete",
  error: "Run failed",
};

const faultCopy: Record<RunState, string> = {
  ready: "Ready · choose a fault profile",
  running: "Running fault profile",
  cancelled: "Run cancelled",
  complete: "Fault runs complete",
  error: "Fault runs complete",
};

const replayCopy = {
  running: "Replaying recorded run",
  cancelled: "Replay stopped",
  done: "Replay complete",
} as const;

export function AgentLabClient({ scenarios, strategies, faultProfiles }: AgentLabClientProps) {
  const [scenarioId, setScenarioId] = useState<AgentLabScenarioId>(scenarios[0]!.id);
  const [strategyId, setStrategyId] = useState<AgentLabStrategyId>(strategies[0]!.id);
  const [view, setView] = useState<View>("inspect");
  const [runs, setRuns] = useState<Record<string, RunView>>({});
  const [busy, setBusy] = useState(false);
  const [replaying, setReplaying] = useState(false);
  // What the status region last announced besides the run state: a download, a fault outcome or a
  // refused file.
  const [notice, setNotice] = useState<string>();
  const [replayError, setReplayError] = useState<string>();
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const replayRef = useRef<AbortController | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locked = busy || replaying;

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      replayRef.current?.abort();
    },
    [],
  );

  const selectedScenario = scenarios.find((scenario) => scenario.id === scenarioId)!;
  const runOf = (key: string): RunView => runs[key] ?? emptyRun();
  const patch = (key: string, change: Partial<RunView> | ((run: RunView) => RunView)) =>
    setRuns((current) => {
      const run = current[key] ?? emptyRun();
      return {
        ...current,
        [key]: typeof change === "function" ? change(run) : { ...run, ...change },
      };
    });

  // Runs go one after another so each one's latency is measured on its own.
  const start = async (jobs: readonly Job[]) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setNotice(undefined);
    setReplayError(undefined);
    setBusy(true);
    for (const job of jobs) {
      setRuns((current) => ({ ...current, [job.key]: { ...emptyRun(), state: "running" } }));
      try {
        const response = await fetch("/api/agent-lab/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(job.body),
          signal: controller.signal,
        });
        const completed = await readAgentLabStream(response, (event) =>
          patch(job.key, (run) => ({ ...run, events: [...run.events, event] })),
        );
        patch(job.key, { artifact: completed, state: "complete" });
        if (job.profile) setNotice(`${job.profile.title}: ${faultOutcome(completed).label}`);
      } catch (caught) {
        if (controller.signal.aborted) {
          patch(job.key, { state: "cancelled" });
          setNotice(undefined);
          break;
        }
        if (job.profile && caught instanceof AgentLabRunError) {
          // A fault that stops the run is the outcome being shown, so the next profile still runs.
          patch(job.key, { state: "error", error: caught.message, failure: caught.artifact });
          setNotice(`${job.profile.title}: ${faultOutcome(caught.artifact).label}`);
          continue;
        }
        patch(job.key, {
          state: "error",
          error: caught instanceof Error ? caught.message : "Unable to run this experiment.",
          ...(caught instanceof AgentLabRunError ? { failure: caught.artifact } : {}),
        });
        break;
      }
    }
    // After several profiles, the status reads as a whole instead of repeating the last card's outcome.
    if (jobs.length > 1 && !controller.signal.aborted) setNotice(undefined);
    if (controllerRef.current === controller) controllerRef.current = undefined;
    setBusy(false);
  };

  // Plays a recorded artifact back through the same views as a live run. Nothing is requested from
  // the server, and a refused file leaves whatever result is already on the page.
  const replay = async (file: File) => {
    setNotice(undefined);
    setReplayError(undefined);
    // Lock the controls while the file is read, so a run started meanwhile cannot be overwritten
    // by this file when it arrives.
    const controller = new AbortController();
    replayRef.current = controller;
    setReplaying(true);
    const parsed = await readReplayFile(file);
    const artifact = parsed.ok ? parsed.artifact : undefined;
    const registered =
      artifact &&
      scenarios.some((scenario) => scenario.id === artifact.scenarioId) &&
      strategies.some((strategy) => strategy.id === artifact.strategyId) &&
      (artifact.faultProfileId === null ||
        faultProfiles.some((profile) => profile.id === artifact.faultProfileId));
    if (controller.signal.aborted || !artifact || !registered) {
      if (!controller.signal.aborted) {
        setNotice("Replay failed");
        setReplayError(
          parsed.ok
            ? "This artifact names a scenario, strategy or fault profile that is not registered on this page."
            : parsed.message,
        );
      }
      if (replayRef.current === controller) replayRef.current = undefined;
      setReplaying(false);
      return;
    }
    const key = artifact.faultProfileId ? faultKey(artifact.faultProfileId) : artifact.strategyId;
    setScenarioId(artifact.scenarioId);
    setStrategyId(artifact.strategyId);
    setView(artifact.faultProfileId ? "failures" : "inspect");
    setRuns({
      [key]: {
        ...emptyRun(),
        state: "running",
        replay: {
          runId: artifact.runId,
          startedAt: artifact.startedAt,
          total: artifact.events.length,
        },
      },
    });
    const finished = await replayEvents(
      artifact.events,
      (event) => patch(key, (run) => ({ ...run, events: [...run.events, event] })),
      controller.signal,
    );
    patch(
      key,
      !finished
        ? { state: "cancelled" }
        : artifact.status === "completed"
          ? { artifact, state: "complete" }
          : { failure: artifact, state: "error", error: artifact.failure.message },
    );
    if (replayRef.current === controller) replayRef.current = undefined;
    setReplaying(false);
  };

  const chooseFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clearing the chooser lets the same file be chosen again.
    event.target.value = "";
    if (file) void replay(file);
  };

  const strategyJob = (id: AgentLabStrategyId): Job => ({
    key: id,
    body: { scenarioId, strategyId: id, dataMode: "fixture" },
  });

  const runSelected = () => {
    if (busy) {
      controllerRef.current?.abort();
      return;
    }
    setView("inspect");
    void start([strategyJob(strategyId)]);
  };

  const compare = () => {
    setView("compare");
    void start(strategies.map((strategy) => strategyJob(strategy.id)));
  };

  // A profile runs on the scenario and strategy it was registered with, never on the toolbar's choice.
  const runFaults = (ids: readonly AgentLabFaultProfileId[]) => {
    setView("failures");
    void start(
      ids.map((id) => {
        const profile = faultProfiles.find((candidate) => candidate.id === id)!;
        return {
          key: faultKey(id),
          profile,
          body: {
            scenarioId: profile.scenarioId,
            strategyId: profile.strategyId,
            dataMode: "fixture",
            faultProfileId: id,
          },
        };
      }),
    );
  };

  const selected = runOf(strategyId);
  const faultRuns = faultProfiles.map((profile) => runOf(faultKey(profile.id)));
  const replayRun =
    view === "failures"
      ? faultRuns.find((run) => run.replay !== undefined)
      : view === "inspect" && selected.replay
        ? selected
        : undefined;
  const activeState: RunState = locked
    ? "running"
    : view === "compare"
      ? (strategies
          .map((strategy) => runOf(strategy.id).state)
          .find((state) => state !== "complete") ?? "complete")
      : view === "failures"
        ? faultRuns.some((run) => run.state === "cancelled")
          ? "cancelled"
          : faultRuns.some((run) => run.state !== "ready")
            ? "complete"
            : "ready"
        : selected.state;
  const errorRun =
    view === "compare"
      ? strategies.map((strategy) => runOf(strategy.id)).find((run) => run.state === "error")
      : view === "inspect" && selected.state === "error"
        ? selected
        : undefined;
  const reading = replaying && !replayRun;
  const replayLabel = replayRun
    ? replayRun.state === "running"
      ? replayCopy.running
      : replayRun.state === "cancelled"
        ? replayCopy.cancelled
        : replayCopy.done
    : undefined;
  const statusLabel =
    notice ??
    (reading ? "Reading artifact" : undefined) ??
    replayLabel ??
    (view === "failures" ? faultCopy[activeState] : statusCopy[activeState]);
  const hasRun = strategies.some((strategy) => runOf(strategy.id).state !== "ready");
  const sides = strategies.map((strategy) => {
    const run = runOf(strategy.id);
    return { label: strategy.label, events: run.events, artifact: run.artifact };
  });
  const selectedLabel = strategies.find((strategy) => strategy.id === strategyId)!.label;

  return (
    <main className="agent-lab" aria-busy={busy}>
      <header className="agent-lab__header">
        <div>
          <Link className="agent-lab__home" href="/">
            AI Trip Planner
          </Link>
          <p className="agent-lab__eyebrow">Engineering demo</p>
          <h1>Agent Lab</h1>
          <p className="agent-lab__intro">
            Run one fixed travel-planning experiment and inspect the evidence from request to
            validated plan. Fixture data keeps the result repeatable and needs no API key.
          </p>
        </div>
        <div className="agent-lab__purpose" aria-label="Experiment purpose">
          <span>Question</span>
          <strong>
            What do specialization and targeted revision each change on the same bounded travel
            brief?
          </strong>
        </div>
      </header>

      <section className="agent-lab__toolbar" aria-label="Experiment controls">
        <label className="agent-lab__field">
          <span>Scenario</span>
          <select
            value={scenarioId}
            onChange={(event) => {
              // A result belongs to the scenario that produced it; do not show it under another.
              setScenarioId(event.target.value as AgentLabScenarioId);
              // Fault runs keep their own scenario, so only the strategy runs are dropped.
              setRuns((current) =>
                Object.fromEntries(
                  Object.entries(current).filter(([key]) => key.startsWith("fault:")),
                ),
              );
              setNotice(undefined);
              setReplayError(undefined);
            }}
            disabled={locked}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.title}
              </option>
            ))}
          </select>
        </label>
        <label className="agent-lab__field">
          <span>Strategy</span>
          <select
            value={strategyId}
            onChange={(event) => setStrategyId(event.target.value as AgentLabStrategyId)}
            disabled={locked}
          >
            {strategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.label}
              </option>
            ))}
          </select>
        </label>
        <div className="agent-lab__mode">
          <span>Data mode</span>
          <strong>Fixture data</strong>
          <small>No external calls</small>
        </div>
        <div className="agent-lab__actions">
          <button
            className="agent-lab__run primary"
            type="button"
            onClick={runSelected}
            disabled={replaying}
          >
            {busy ? "Cancel run" : "Run experiment"}
          </button>
          <button
            className="agent-lab__secondary"
            type="button"
            onClick={compare}
            disabled={locked}
          >
            Compare all strategies
          </button>
          {/* One element for both jobs, so keyboard focus stays on it when a replay starts. */}
          <button
            className="agent-lab__secondary"
            type="button"
            onClick={() => (replaying ? replayRef.current?.abort() : fileInputRef.current?.click())}
            disabled={busy}
          >
            {replaying ? "Stop replay" : "Replay artifact"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            data-agent-lab-replay-input
            disabled={locked}
            onChange={chooseFile}
          />
        </div>
      </section>

      <div className="agent-lab__status" role="status">
        <span
          className={`agent-lab__status-mark agent-lab__status-mark--${replayError ? "error" : activeState}`}
          aria-hidden="true"
        />
        <span>{statusLabel}</span>
        {replaying && replayRun?.replay ? (
          <span>
            {" "}
            · event {replayRun.events.length} of {replayRun.replay.total}
          </span>
        ) : null}
        {activeState === "ready" && !notice ? <span> · {selectedScenario.summary}</span> : null}
      </div>

      {replayError ? (
        <p className="agent-lab__error" role="alert" data-agent-lab-replay-error>
          Could not replay this file. {replayError}
        </p>
      ) : null}

      {errorRun?.error ? (
        <p className="agent-lab__error" role="alert">
          {errorRun.error}
          {errorRun.failure
            ? ` The run stopped after event ${errorRun.failure.failure.atSequence} (${errorRun.failure.metrics.durationMs} ms); the events recorded so far are kept below.`
            : ""}{" "}
          Choose the registered fixture and try again.
        </p>
      ) : null}

      <div className="agent-lab__views" role="group" aria-label="View">
        <button type="button" aria-pressed={view === "inspect"} onClick={() => setView("inspect")}>
          Inspect one run
        </button>
        <button
          type="button"
          aria-pressed={view === "compare"}
          onClick={() => setView("compare")}
          disabled={!hasRun}
        >
          Compare strategies
        </button>
        <button
          type="button"
          aria-pressed={view === "failures"}
          onClick={() => setView("failures")}
        >
          Failures
        </button>
      </div>

      {view === "failures" ? (
        <FailureLab
          profiles={faultProfiles}
          scenarioTitle={(id) => scenarios.find((scenario) => scenario.id === id)?.title ?? id}
          strategyLabel={(id) => strategies.find((strategy) => strategy.id === id)?.label ?? id}
          runs={runs}
          locked={locked}
          onRun={(id) => runFaults([id])}
          onRunAll={() => runFaults(faultProfiles.map((profile) => profile.id))}
          onDownloaded={(filename) => setNotice(`Artifact downloaded: ${filename}`)}
        />
      ) : view === "compare" ? (
        <ComparisonPanel
          sides={sides}
          onDownloaded={(filename) => setNotice(`Artifact downloaded: ${filename}`)}
        />
      ) : (
        <div className="agent-lab__grid">
          <section className="agent-lab__panel" aria-labelledby="agent-lab-timeline-title">
            <div className="agent-lab__panel-heading">
              <div>
                <p className="agent-lab__kicker">Trace</p>
                <h2 id="agent-lab-timeline-title">Run timeline</h2>
              </div>
              <span>{selected.events.length} events</span>
            </div>
            {selected.replay ? (
              <p className="agent-lab__replay-note" data-agent-lab-replay-note>
                Replay of recorded run <code>{selected.replay.runId}</code> from{" "}
                {selected.replay.startedAt}. Nothing is run again: events appear at their recorded
                times.
              </p>
            ) : null}
            {selected.events.length ? (
              <RunTimeline events={selected.events} label="Run events" />
            ) : (
              <div className="agent-lab__empty">
                <strong>No run yet</strong>
                <p>Start the fixture experiment to see each validated event in order.</p>
              </div>
            )}
          </section>

          <section className="agent-lab__panel" aria-labelledby="agent-lab-plan-title">
            <div className="agent-lab__panel-heading">
              <div>
                <p className="agent-lab__kicker">Outcome</p>
                <h2 id="agent-lab-plan-title">Plan result</h2>
              </div>
              {selected.artifact ? <span>{money(selected.artifact.plan.estTotal)}</span> : null}
            </div>
            {selected.artifact ? (
              <>
                <PlanSummary plan={selected.artifact.plan} />
                <PlanSections plan={selected.artifact.plan} />
              </>
            ) : (
              <div className="agent-lab__empty">
                <strong>The plan will appear here</strong>
                <p>The result is rendered only after the shared TripPlan contract validates it.</p>
              </div>
            )}
          </section>

          <section className="agent-lab__panel" aria-labelledby="agent-lab-evidence-title">
            <div className="agent-lab__panel-heading">
              <div>
                <p className="agent-lab__kicker">Evidence</p>
                <h2 id="agent-lab-evidence-title">Run metrics</h2>
              </div>
              {selected.artifact ? <span>Schema v{selected.artifact.schemaVersion}</span> : null}
            </div>
            {selected.artifact ? (
              <>
                <MetricsList artifact={selected.artifact} />
                <div className="agent-lab__artifact-actions">
                  <DownloadArtifactButton
                    artifact={selected.artifact}
                    label={selectedLabel}
                    onDownloaded={(filename) => setNotice(`Artifact downloaded: ${filename}`)}
                  />
                </div>
              </>
            ) : (
              <div className="agent-lab__empty">
                <strong>Measured, not judged</strong>
                <p>Budget, sections and constraints are calculated from the plan and trace.</p>
              </div>
            )}
          </section>
        </div>
      )}

      <DesignNotes />
    </main>
  );
}
