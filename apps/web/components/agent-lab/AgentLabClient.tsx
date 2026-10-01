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

interface ScenarioSummary {
  id: AgentLabScenarioId;
  title: string;
  summary: string;
}

interface AgentLabClientProps {
  scenarios: readonly ScenarioSummary[];
}

type RunState = "ready" | "running" | "cancelled" | "complete" | "error";

const strategyOptions: readonly { id: AgentLabStrategyId; label: string }[] = [
  { id: "single-agent-baseline", label: "Single-agent baseline" },
];

const statusCopy: Record<RunState, string> = {
  ready: "Ready",
  running: "Running fixture experiment",
  cancelled: "Run cancelled",
  complete: "Run complete",
  error: "Run failed",
};

function money(value: number): string {
  return `A$${value.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

function eventCopy(runEvent: AgentLabRunEvent): { title: string; detail: string } {
  const event = runEvent.event;
  switch (event.type) {
    case "lab_run_started":
      return { title: "Run started", detail: event.summary };
    case "lab_strategy_started":
      return { title: "Single agent started", detail: event.objective };
    case "lab_tool_started":
      return { title: event.label, detail: event.summary };
    case "lab_tool_completed":
      return { title: event.label, detail: event.resultSummary };
    case "lab_plan_validated":
      return { title: "Plan validated", detail: event.summary };
    case "lab_evaluation_completed":
      return { title: "Evaluation complete", detail: event.summary };
    case "lab_strategy_completed":
      return { title: "Single agent completed", detail: event.summary };
    case "lab_run_completed":
      return { title: "Run completed", detail: event.summary };
    case "agent_reasoning":
      return { title: `${event.agent} reasoning`, detail: event.text };
    case "coordinator":
      return { title: `Coordinator · ${event.phase}`, detail: event.summary };
    case "agent_started":
      return {
        title: `${event.agent} started`,
        detail: event.objective ?? event.summary ?? "Started.",
      };
    case "agent_completed":
      return {
        title: `${event.agent} completed`,
        detail: event.outcome ?? event.summary ?? "Completed.",
      };
    case "agent_failed":
      return { title: `${event.agent} failed`, detail: event.error };
    case "tool_started":
      return { title: event.label, detail: event.summary };
    case "tool_completed":
      return { title: event.label, detail: event.resultSummary };
    case "tool_failed":
      return { title: event.label, detail: event.error };
  }
}

export function AgentLabClient({ scenarios }: AgentLabClientProps) {
  const [scenarioId, setScenarioId] = useState<AgentLabScenarioId>(scenarios[0]!.id);
  const [strategyId, setStrategyId] = useState<AgentLabStrategyId>(strategyOptions[0]!.id);
  const [runState, setRunState] = useState<RunState>("ready");
  const [events, setEvents] = useState<AgentLabRunEvent[]>([]);
  const [artifact, setArtifact] = useState<AgentLabCompletedRunArtifact>();
  const [failure, setFailure] = useState<AgentLabFailedRunArtifact>();
  const [error, setError] = useState<string>();
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const selectedScenario = scenarios.find((scenario) => scenario.id === scenarioId)!;

  const run = async () => {
    if (runState === "running") {
      controllerRef.current?.abort();
      setRunState("cancelled");
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setRunState("running");
    setEvents([]);
    setArtifact(undefined);
    setFailure(undefined);
    setError(undefined);
    try {
      const response = await fetch("/api/agent-lab/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId, strategyId, dataMode: "fixture" }),
        signal: controller.signal,
      });
      const completed = await readAgentLabStream(response, (event) => {
        setEvents((current) => [...current, event]);
      });
      setArtifact(completed);
      setRunState("complete");
    } catch (caught) {
      if (controller.signal.aborted) {
        setRunState("cancelled");
      } else {
        if (caught instanceof AgentLabRunError) setFailure(caught.artifact);
        setError(caught instanceof Error ? caught.message : "Unable to run this experiment.");
        setRunState("error");
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = undefined;
    }
  };

  return (
    <main className="agent-lab" aria-busy={runState === "running"}>
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
          <strong>What does one agent produce from the same bounded travel brief?</strong>
        </div>
      </header>

      <section className="agent-lab__toolbar" aria-label="Experiment controls">
        <label className="agent-lab__field">
          <span>Scenario</span>
          <select
            value={scenarioId}
            onChange={(event) => setScenarioId(event.target.value as AgentLabScenarioId)}
            disabled={runState === "running"}
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
            disabled={runState === "running"}
          >
            {strategyOptions.map((strategy) => (
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
        <button className="agent-lab__run primary" type="button" onClick={run}>
          {runState === "running" ? "Cancel run" : "Run experiment"}
        </button>
      </section>

      <div className="agent-lab__status" role="status">
        <span
          className={`agent-lab__status-mark agent-lab__status-mark--${runState}`}
          aria-hidden="true"
        />
        <span>{statusCopy[runState]}</span>
        {runState === "ready" ? <span> · {selectedScenario.summary}</span> : null}
      </div>

      {error ? (
        <p className="agent-lab__error" role="alert">
          {error}
          {failure
            ? ` The run stopped after event ${failure.failure.atSequence} (${failure.metrics.durationMs} ms); the events recorded so far are kept below.`
            : ""}{" "}
          Choose the registered fixture and try again.
        </p>
      ) : null}

      <div className="agent-lab__grid">
        <section className="agent-lab__panel" aria-labelledby="agent-lab-timeline-title">
          <div className="agent-lab__panel-heading">
            <div>
              <p className="agent-lab__kicker">Trace</p>
              <h2 id="agent-lab-timeline-title">Run timeline</h2>
            </div>
            <span>{events.length} events</span>
          </div>
          {events.length ? (
            <ol className="agent-lab__timeline" aria-label="Run events">
              {events.map((runEvent) => {
                const copy = eventCopy(runEvent);
                return (
                  <li key={`${runEvent.runId}-${runEvent.sequence}`} data-agent-lab-event>
                    <span className="agent-lab__sequence">{runEvent.sequence}</span>
                    <div>
                      <strong>{copy.title}</strong>
                      <p>{copy.detail}</p>
                      <small>+{runEvent.elapsedMs} ms</small>
                    </div>
                  </li>
                );
              })}
            </ol>
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
            {artifact ? <span>{money(artifact.plan.estTotal)}</span> : null}
          </div>
          {artifact ? (
            <>
              <div className="agent-lab__plan-summary">
                <div>
                  <span>Destination</span>
                  <strong>{artifact.plan.brief.destination}</strong>
                </div>
                <div>
                  <span>Budget</span>
                  <strong>{money(artifact.plan.budgetTotal)}</strong>
                </div>
                <div>
                  <span>Estimated</span>
                  <strong>{money(artifact.plan.estTotal)}</strong>
                </div>
              </div>
              <div className="agent-lab__sections">
                {artifact.plan.sections.map((section) => (
                  <article key={section.id} data-agent-lab-section>
                    <div>
                      <span>{section.label}</span>
                      <strong>{section.summary}</strong>
                    </div>
                    <b>{money(section.estCost)}</b>
                  </article>
                ))}
              </div>
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
            {artifact ? <span>Schema v{artifact.schemaVersion}</span> : null}
          </div>
          {artifact ? (
            <>
              <dl className="agent-lab__metrics">
                <div>
                  <dt>Budget</dt>
                  <dd>{artifact.metrics.withinBudget ? "Within budget" : "Over budget"}</dd>
                  <small>
                    {artifact.metrics.withinBudget
                      ? `${money(artifact.metrics.budgetHeadroom)} remaining`
                      : `${money(-artifact.metrics.budgetHeadroom)} over`}
                  </small>
                </div>
                <div>
                  <dt>Checks</dt>
                  <dd>
                    {artifact.metrics.checks.filter((check) => check.passed).length}/
                    {artifact.metrics.checks.length} passed
                  </dd>
                  <small>Deterministic checks</small>
                </div>
                <div>
                  <dt>Sections</dt>
                  <dd>{artifact.metrics.sectionCount}</dd>
                  <small>Validated plan sections</small>
                </div>
                <div>
                  <dt>Trace</dt>
                  <dd>{artifact.metrics.eventCount} events</dd>
                  <small>{artifact.metrics.durationMs} ms recorded</small>
                </div>
              </dl>
              <ul className="agent-lab__checks" aria-label="Deterministic checks">
                {artifact.metrics.checks.map((check) => (
                  <li key={check.id} data-agent-lab-check={check.id} data-passed={check.passed}>
                    <span>{check.passed ? "Passed" : "Failed"}</span>
                    {check.label}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="agent-lab__empty">
              <strong>Measured, not judged</strong>
              <p>Budget, sections and constraints are calculated from the plan and trace.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
