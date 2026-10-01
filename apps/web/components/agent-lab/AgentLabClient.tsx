"use client";

import {
  type AgentLabCompletedRunArtifact,
  type AgentLabFailedRunArtifact,
  type AgentLabRunEvent,
  type AgentLabScenarioId,
  type AgentLabStrategyId,
} from "@trip/shared";
import Link from "next/link";
import { useRef, useState } from "react";
import { AgentLabRunError, readAgentLabStream } from "@/lib/agent-lab/stream";
import { money } from "@/lib/agent-lab/format";
import { ComparisonPanel } from "./ComparisonPanel";
import { DesignNotes } from "./DesignNotes";
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
}

type RunState = "ready" | "running" | "cancelled" | "complete" | "error";

interface RunView {
  state: RunState;
  events: AgentLabRunEvent[];
  artifact?: AgentLabCompletedRunArtifact;
  failure?: AgentLabFailedRunArtifact;
  error?: string;
}

const statusCopy: Record<RunState, string> = {
  ready: "Ready",
  running: "Running fixture experiment",
  cancelled: "Run cancelled",
  complete: "Run complete",
  error: "Run failed",
};

const emptyRun = (): RunView => ({ state: "ready", events: [] });

export function AgentLabClient({ scenarios, strategies }: AgentLabClientProps) {
  const [scenarioId, setScenarioId] = useState<AgentLabScenarioId>(scenarios[0]!.id);
  const [strategyId, setStrategyId] = useState<AgentLabStrategyId>(strategies[0]!.id);
  const [view, setView] = useState<"inspect" | "compare">("inspect");
  const [runs, setRuns] = useState<Record<string, RunView>>({});
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | undefined>(undefined);
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

  // Strategies run one after another so each one's latency is measured on its own.
  const start = async (targets: readonly AgentLabStrategyId[]) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    for (const target of targets) {
      setRuns((current) => ({ ...current, [target]: { ...emptyRun(), state: "running" } }));
      try {
        const response = await fetch("/api/agent-lab/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenarioId, strategyId: target, dataMode: "fixture" }),
          signal: controller.signal,
        });
        const completed = await readAgentLabStream(response, (event) =>
          patch(target, (run) => ({ ...run, events: [...run.events, event] })),
        );
        patch(target, { artifact: completed, state: "complete" });
      } catch (caught) {
        if (controller.signal.aborted) {
          patch(target, { state: "cancelled" });
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
    void start(strategies.map((strategy) => strategy.id));
  };

  const selected = runOf(strategyId);
  const activeState: RunState = busy
    ? "running"
    : view === "compare"
      ? (strategies
          .map((strategy) => runOf(strategy.id).state)
          .find((state) => state !== "complete") ?? "complete")
      : selected.state;
  const errorRun =
    view === "compare"
      ? strategies.map((strategy) => runOf(strategy.id)).find((run) => run.state === "error")
      : selected.state === "error"
        ? selected
        : undefined;
  const hasRun = strategies.some((strategy) => runOf(strategy.id).state !== "ready");
  const sides = strategies.map((strategy) => {
    const run = runOf(strategy.id);
    return { label: strategy.label, events: run.events, artifact: run.artifact };
  });

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
            }}
            disabled={busy}
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
            disabled={busy}
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
          <button className="agent-lab__run primary" type="button" onClick={runSelected}>
            {busy ? "Cancel run" : "Run experiment"}
          </button>
          <button className="agent-lab__secondary" type="button" onClick={compare} disabled={busy}>
            Compare all strategies
          </button>
        </div>
      </section>

      <div className="agent-lab__status" role="status">
        <span
          className={`agent-lab__status-mark agent-lab__status-mark--${activeState}`}
          aria-hidden="true"
        />
        <span>{statusCopy[activeState]}</span>
        {activeState === "ready" ? <span> · {selectedScenario.summary}</span> : null}
      </div>

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
        <ComparisonPanel sides={sides} />
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
              <MetricsList artifact={selected.artifact} />
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
