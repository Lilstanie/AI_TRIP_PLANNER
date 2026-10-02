"use client";

import {
  type AgentLabCompletedRunArtifact,
  type AgentLabDataMode,
  type AgentLabFailedRunArtifact,
  type AgentLabRejectionReason,
  type AgentLabRunEvent,
  type AgentLabScenarioId,
  type AgentLabStrategyId,
} from "@trip/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AgentLabRejectedError,
  AgentLabRunError,
  readAgentLabStream,
} from "@/lib/agent-lab/stream";
import { money } from "@/lib/agent-lab/format";
import { readReplayFile, replayEvents } from "@/lib/agent-lab/replay";
import { ComparisonPanel } from "./ComparisonPanel";
import { DesignNotes } from "./DesignNotes";
import { DownloadArtifactButton } from "./DownloadArtifactButton";
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
  /** False for the scripted baseline, which replays a recording and has no live implementation. */
  live: boolean;
}

interface AgentLabClientProps {
  scenarios: readonly ScenarioSummary[];
  strategies: readonly StrategySummary[];
  /** Whether this deployment has explicitly enabled live runs; read on the server, never guessed here. */
  liveEnabled: boolean;
}

type RunState = "ready" | "running" | "cancelled" | "complete" | "error" | "rejected";

interface RunView {
  state: RunState;
  events: AgentLabRunEvent[];
  artifact?: AgentLabCompletedRunArtifact;
  failure?: AgentLabFailedRunArtifact;
  error?: string;
  // Set when the server turned the request away before a run started: not a failed experiment.
  rejection?: { reason: AgentLabRejectionReason; message: string; retryAfterSeconds?: number };
  // Set when the events come from a recorded artifact rather than a run on this page.
  replay?: { runId: string; startedAt: string; total: number };
}

const statusCopy: Record<RunState, string> = {
  ready: "Ready",
  running: "Running fixture experiment",
  cancelled: "Run cancelled",
  complete: "Run complete",
  error: "Run failed",
  rejected: "Live run not started",
};

const modeLabel: Record<AgentLabDataMode, string> = {
  fixture: "Fixture data",
  live: "Live data",
};

const retryHint = (seconds?: number) =>
  seconds === undefined
    ? ""
    : seconds >= 120
      ? ` Try again in about ${Math.ceil(seconds / 60)} minutes.`
      : ` Try again in about ${seconds} seconds.`;

const replayCopy: Partial<Record<RunState, string>> = {
  running: "Replaying recorded run",
  cancelled: "Replay stopped",
  complete: "Replay complete",
};

const emptyRun = (): RunView => ({ state: "ready", events: [] });

export function AgentLabClient({ scenarios, strategies, liveEnabled }: AgentLabClientProps) {
  const [scenarioId, setScenarioId] = useState<AgentLabScenarioId>(scenarios[0]!.id);
  const [strategyId, setStrategyId] = useState<AgentLabStrategyId>(strategies[0]!.id);
  const [view, setView] = useState<"inspect" | "compare">("inspect");
  const [dataMode, setDataMode] = useState<AgentLabDataMode>("fixture");
  const [runs, setRuns] = useState<Record<string, RunView>>({});
  const [busy, setBusy] = useState(false);
  const [replaying, setReplaying] = useState(false);
  // What the status region last announced besides the run state: a download or a refused file.
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
  const runOf = (id: AgentLabStrategyId): RunView => runs[id] ?? emptyRun();
  const patch = (id: AgentLabStrategyId, change: Partial<RunView> | ((run: RunView) => RunView)) =>
    setRuns((current) => {
      const run = current[id] ?? emptyRun();
      return {
        ...current,
        [id]: typeof change === "function" ? change(run) : { ...run, ...change },
      };
    });

  // Strategies a request can use in the chosen mode: live needs a live implementation.
  const available = strategies.filter((strategy) => dataMode === "fixture" || strategy.live);

  // Strategies run one after another so each one's latency is measured on its own.
  const start = async (targets: readonly AgentLabStrategyId[]) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setNotice(undefined);
    setReplayError(undefined);
    setBusy(true);
    for (const target of targets) {
      setRuns((current) => ({ ...current, [target]: { ...emptyRun(), state: "running" } }));
      try {
        const response = await fetch("/api/agent-lab/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenarioId, strategyId: target, dataMode }),
          signal: controller.signal,
        });
        const completed = await readAgentLabStream(response, (event) =>
          patch(target, (run) => ({ ...run, events: [...run.events, event] })),
        );
        patch(target, { artifact: completed, state: "complete" });
      } catch (caught) {
        if (controller.signal.aborted) {
          patch(target, { state: "cancelled" });
        } else if (caught instanceof AgentLabRejectedError) {
          // Turned away before a run began; say why in plain words, and do not call it a failed run.
          patch(target, {
            state: "rejected",
            rejection: {
              reason: caught.reason,
              message: caught.message,
              retryAfterSeconds: caught.retryAfterSeconds,
            },
          });
        } else {
          patch(target, {
            state: "error",
            error: caught instanceof Error ? caught.message : "Unable to run this experiment.",
            ...(caught instanceof AgentLabRunError ? { failure: caught.artifact } : {}),
          });
        }
        break;
      }
    }
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
      strategies.some((strategy) => strategy.id === artifact.strategyId);
    if (controller.signal.aborted || !artifact || !registered) {
      if (!controller.signal.aborted) {
        setNotice("Replay failed");
        setReplayError(
          parsed.ok
            ? "This artifact names a scenario or strategy that is not registered on this page."
            : parsed.message,
        );
      }
      if (replayRef.current === controller) replayRef.current = undefined;
      setReplaying(false);
      return;
    }
    const target = artifact.strategyId;
    setScenarioId(artifact.scenarioId);
    setStrategyId(target);
    setView("inspect");
    setRuns({
      [target]: {
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
      (event) => patch(target, (run) => ({ ...run, events: [...run.events, event] })),
      controller.signal,
    );
    patch(target, finished ? { artifact, state: "complete" } : { state: "cancelled" });
    if (replayRef.current === controller) replayRef.current = undefined;
    setReplaying(false);
  };

  const chooseFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clearing the chooser lets the same file be chosen again.
    event.target.value = "";
    if (file) void replay(file);
  };

  const runSelected = () => {
    if (busy) {
      controllerRef.current?.abort();
      return;
    }
    setView("inspect");
    void start([strategyId]);
  };

  const compare = () => {
    setView("compare");
    void start(available.map((strategy) => strategy.id));
  };

  const selected = runOf(strategyId);
  const replayView = view === "inspect" && selected.replay !== undefined;
  const activeState: RunState = locked
    ? "running"
    : view === "compare"
      ? (available
          .map((strategy) => runOf(strategy.id).state)
          .find((state) => state !== "complete") ?? "complete")
      : selected.state;
  const errorRun =
    view === "compare"
      ? strategies.map((strategy) => runOf(strategy.id)).find((run) => run.state === "error")
      : selected.state === "error"
        ? selected
        : undefined;
  const rejectedRun =
    view === "compare"
      ? available.map((strategy) => runOf(strategy.id)).find((run) => run.state === "rejected")
      : selected.state === "rejected"
        ? selected
        : undefined;
  const reading = replaying && !selected.replay;
  const statusLabel =
    notice ??
    (reading ? "Reading artifact" : undefined) ??
    (replayView ? replayCopy[activeState] : undefined) ??
    (activeState === "running" ? `Running ${dataMode} experiment` : statusCopy[activeState]);
  const hasRun = strategies.some((strategy) => runOf(strategy.id).state !== "ready");
  const sides = available.map((strategy) => {
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
              setRuns({});
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
              <option
                key={strategy.id}
                value={strategy.id}
                disabled={dataMode === "live" && !strategy.live}
              >
                {strategy.label}
                {dataMode === "live" && !strategy.live ? " (fixture only)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="agent-lab__mode">
          <label className="agent-lab__field">
            <span>Data mode</span>
            <select
              value={dataMode}
              onChange={(event) => {
                // A result belongs to the mode that produced it; do not show it under another.
                const next = event.target.value as AgentLabDataMode;
                setDataMode(next);
                setRuns({});
                setNotice(undefined);
                setReplayError(undefined);
                const current = strategies.find((strategy) => strategy.id === strategyId);
                if (next === "live" && current && !current.live) {
                  setStrategyId(strategies.find((strategy) => strategy.live)?.id ?? strategyId);
                }
              }}
              disabled={locked}
            >
              <option value="fixture">{modeLabel.fixture}</option>
              <option value="live" disabled={!liveEnabled}>
                {modeLabel.live}
                {liveEnabled ? "" : " (not enabled)"}
              </option>
            </select>
          </label>
          <small data-agent-lab-mode-note>
            {dataMode === "live"
              ? "Uses this deployment's own models and providers, within its limits."
              : liveEnabled
                ? "No external calls."
                : "No external calls. Live runs are not enabled on this deployment."}
          </small>
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
        {replaying && selected.replay ? (
          <span>
            {" "}
            · event {selected.events.length} of {selected.replay.total}
          </span>
        ) : null}
        {activeState === "ready" && !notice ? <span> · {selectedScenario.summary}</span> : null}
      </div>

      {replayError ? (
        <p className="agent-lab__error" role="alert" data-agent-lab-replay-error>
          Could not replay this file. {replayError}
        </p>
      ) : null}

      {rejectedRun?.rejection ? (
        <p
          className="agent-lab__notice"
          role="alert"
          data-agent-lab-rejection={rejectedRun.rejection.reason}
        >
          {rejectedRun.rejection.message}
          {retryHint(rejectedRun.rejection.retryAfterSeconds)} Nothing was run, and this is not a
          failed experiment. Fixture data is always available.
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
      </div>

      {view === "compare" ? (
        <ComparisonPanel
          provenance={
            [
              ...new Set(
                sides.flatMap((side) => (side.artifact ? [modeLabel[side.artifact.dataMode]] : [])),
              ),
            ].join(" and ") || modeLabel[dataMode]
          }
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
              <span data-agent-lab-provenance>
                {selected.events.length} events ·{" "}
                {modeLabel[selected.events[0]?.dataMode ?? dataMode]}
              </span>
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
              {selected.artifact ? (
                <span data-agent-lab-provenance>
                  Schema v{selected.artifact.schemaVersion} ·{" "}
                  {modeLabel[selected.artifact.dataMode]}
                </span>
              ) : null}
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
