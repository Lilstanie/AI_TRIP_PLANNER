// Failure inventory, written before the module:
// - a run that lost a specialist's section to a provider failure reads as plain success;
// - a run that stopped reads as degraded, or a degraded one as failed, so the three ways a fault can end
//   (carry on with less, keep a partial result, stop) blur together;
// - a failed run does not say which capability failed, or says nothing about the events it kept;
// - a schema rejection is reported without the rejected fields, or an empty provider result is hidden;
// - the supervisor's fallback is not reported, or is reported as a failure of the run;
// - a figure (events, failed tools, failed agents, unavailable sections) disagrees with the trace it is
//   read from, or an unavailable one is shown as zero;
// - the outcome depends on anything but the artifact, so a live run, a downloaded file and a replay of
//   it could read differently.
import { describe, expect, it } from "vitest";
import type { AgentLabEventPayload, AgentLabRunArtifact } from "@trip/shared";
import { faultOutcome } from "@/lib/agent-lab/fault-outcome";

const envelope = (event: AgentLabEventPayload, sequence: number) => ({
  runId: "run-1",
  sequence,
  at: "2026-10-02T00:00:00.000Z",
  elapsedMs: sequence * 10,
  scenarioId: "tokyo-couple",
  strategyId: "multi-agent-no-revision",
  dataMode: "fixture",
  event,
});

const section = (id: string, kind: string) => ({
  id,
  label: id,
  summary: id,
  status: "draft",
  estCost: 0,
  proposal: { agent: id, summary: id, items: [], source: { kind } },
});

const completed = (
  events: AgentLabEventPayload[],
  options: {
    sections?: ReturnType<typeof section>[];
    unresolved?: number;
    stopReason?: string | null;
  } = {},
) =>
  ({
    status: "completed",
    faultProfileId: null,
    failure: null,
    events: events.map((event, index) => envelope(event, index + 1)),
    plan: {
      sections: options.sections ?? [section("transport", "mock"), section("dining", "mock")],
    },
    metrics: {
      unresolvedConflicts: options.unresolved ?? 0,
      stopReason: options.stopReason ?? null,
    },
  }) as unknown as AgentLabRunArtifact;

const failed = (events: AgentLabEventPayload[], agent?: string) =>
  ({
    status: "failed",
    faultProfileId: null,
    events: events.map((event, index) => envelope(event, index + 1)),
    failure: {
      code: agent ? "agent_failed" : "run_failed",
      message: "stopped",
      atSequence: events.length,
      ...(agent ? { agent } : {}),
    },
    metrics: { eventCount: events.length, durationMs: 100 },
  }) as unknown as AgentLabRunArtifact;

const started: AgentLabEventPayload = { type: "lab_run_started", summary: "Started." };
const toolFailed = (agent: string): AgentLabEventPayload =>
  ({
    type: "tool_failed",
    agent,
    round: 1,
    callId: "c1",
    tool: "search_flights",
    label: "Search flights",
    error: "Tool unavailable; continuing with fallback when possible.",
  }) as AgentLabEventPayload;
const agentFailed = (agent: string): AgentLabEventPayload =>
  ({
    type: "agent_failed",
    agent,
    round: 1,
    error: "This specialist could not finish.",
  }) as AgentLabEventPayload;
const emptySearch = (agent: string): AgentLabEventPayload =>
  ({
    type: "tool_completed",
    agent,
    round: 1,
    callId: "c2",
    tool: "search_stays",
    label: "Search stays",
    resultSummary: "0 stays",
    resultCount: 0,
  }) as AgentLabEventPayload;

describe("faultOutcome", () => {
  it("calls a clean run completed, with no failure fact", () => {
    const outcome = faultOutcome(completed([started]));
    expect(outcome.kind).toBe("completed");
    expect(outcome.label).toBe("Completed");
    expect(outcome.figures).toMatchObject({
      toolFailures: 0,
      failedAgents: 0,
      unavailableSections: 0,
    });
  });

  it("calls a run that lost a section to a provider failure degraded, and says which", () => {
    const outcome = faultOutcome(
      completed([started, toolFailed("transport")], {
        sections: [section("transport", "unavailable"), section("dining", "mock")],
        unresolved: 1,
        stopReason: "round_limit",
      }),
    );
    expect(outcome.kind).toBe("degraded");
    expect(outcome.headline).toMatch(/transport/);
    expect(outcome.facts.join(" ")).toMatch(/transport section is unavailable and was not priced/);
    expect(outcome.figures).toMatchObject({
      toolFailures: 1,
      unavailableSections: 1,
      unresolvedConflicts: 1,
      stopReason: "round_limit",
    });
  });

  it("calls a supervisor fallback degraded, not failed", () => {
    const outcome = faultOutcome(
      completed([
        started,
        {
          type: "lab_supervisor_fallback",
          phase: "dispatch",
          round: 1,
          summary: "Dispatched deterministically.",
        },
      ]),
    );
    expect(outcome.kind).toBe("degraded");
    expect(outcome.headline).toMatch(/supervisor/i);
    expect(outcome.facts.join(" ")).toMatch(/Dispatched deterministically/);
  });

  it("calls a revision that did not improve the plan a partial result", () => {
    const outcome = faultOutcome(
      completed(
        [
          started,
          {
            type: "lab_revision_scored",
            round: 2,
            agents: ["transport"],
            scoreBefore: 260,
            scoreAfter: 260,
            kept: false,
            summary: "Not improved.",
          },
        ],
        { unresolved: 1, stopReason: "no_improvement" },
      ),
    );
    expect(outcome.kind).toBe("partial");
    expect(outcome.label).toBe("Partial result");
    expect(outcome.facts.join(" ")).toMatch(/260/);
    expect(outcome.figures.stopReason).toBe("no_improvement");
  });

  it("calls a run that stopped failed, names the capability and the events it kept", () => {
    const outcome = faultOutcome(failed([started, agentFailed("accommodation")], "accommodation"));
    expect(outcome.kind).toBe("failed");
    expect(outcome.headline).toMatch(/accommodation/);
    expect(outcome.facts.join(" ")).toMatch(/No plan was assembled/);
    expect(outcome.facts.join(" ")).toMatch(/2 events/);
    expect(outcome.figures).toMatchObject({
      events: 2,
      failedAgents: 1,
      unresolvedConflicts: null,
      stopReason: null,
    });
  });

  it("reports an empty provider result the workflow did not paper over", () => {
    const outcome = faultOutcome(
      failed(
        [started, emptySearch("accommodation"), agentFailed("accommodation")],
        "accommodation",
      ),
    );
    expect(outcome.facts.join(" ")).toMatch(/accommodation.*no results.*did not invent/i);
  });

  it("reports the fields a schema rejection named", () => {
    const outcome = faultOutcome(
      failed(
        [
          started,
          {
            type: "lab_agent_output_rejected",
            agent: "dining",
            round: 1,
            fields: ["items", "assumptions"],
            summary: "Rejected.",
          },
          agentFailed("dining"),
        ],
        "dining",
      ),
    );
    expect(outcome.facts.join(" ")).toMatch(/schema boundary: items, assumptions/);
  });

  it("falls back to a generic failure when no capability is named", () => {
    const outcome = faultOutcome(failed([started]));
    expect(outcome.kind).toBe("failed");
    expect(outcome.headline).toMatch(/run failed/i);
  });

  it("depends on the artifact alone", () => {
    const artifact = failed([started, agentFailed("dining")], "dining");
    expect(faultOutcome(artifact)).toEqual(faultOutcome(structuredClone(artifact)));
  });
});
