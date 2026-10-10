import { describe, expect, it } from "vitest";
import type {
  AgentLabEventPayload,
  AgentName,
  AgentProposal,
  Specialist,
  SpecialistRequest,
} from "@trip/shared";
import {
  createMultiAgentFixtureStrategy,
  findAgentLabScenario,
  runAgentLab,
} from "../src/agent-lab";

const tight = findAgentLabScenario("tokyo-couple-tight-budget");
const base = findAgentLabScenario("tokyo-couple");
const revising = {
  scenarioId: "tokyo-couple-tight-budget",
  strategyId: "multi-agent-targeted-revision",
  dataMode: "fixture",
} as const;
const plain = { ...revising, strategyId: "multi-agent-no-revision" } as const;
const payloads = (events: { event: AgentLabEventPayload }[]) =>
  events.map((runEvent) => runEvent.event);
const ofType = <T extends AgentLabEventPayload["type"]>(events: AgentLabEventPayload[], type: T) =>
  events.filter((event) => event.type === type) as Extract<AgentLabEventPayload, { type: T }>[];

describe("tight-budget scenario", () => {
  it("has a feasible initial conflict that only the revision strategy repairs", async () => {
    const [without, withRevision] = [
      await runAgentLab(plain, { paceMs: 0 }),
      await runAgentLab(revising, { paceMs: 0 }),
    ];
    expect(without.metrics.unresolvedConflicts).toBeGreaterThan(0);
    expect(without.metrics.withinBudget).toBe(false);
    expect(without.metrics.rounds).toBe(1);
    expect(withRevision.metrics.unresolvedConflicts).toBe(0);
    expect(withRevision.metrics.withinBudget).toBe(true);
    expect(withRevision.metrics.rounds).toBe(2);
    expect(withRevision.plan.budgetTotal).toBe(tight.brief.budgetTotal);
  });

  it("gives both strategies the same first round", async () => {
    const [without, withRevision] = [
      await runAgentLab(plain, { paceMs: 0 }),
      await runAgentLab(revising, { paceMs: 0 }),
    ];

    const firstRound = (events: typeof without.events) => {
      const list = payloads(events).filter((event) => !event.type.startsWith("lab_"));
      return list.slice(
        0,
        list.findIndex((event) => event.type === "coordinator" && event.phase === "conflicts") + 1,
      );
    };
    const rest = firstRound(without.events);
    const restRevising = firstRound(withRevision.events);
    expect(rest.length).toBeGreaterThan(5);
    expect(restRevising).toEqual(rest);
  });
});

describe("targeted revision trace", () => {
  it("identifies the conflict, the specialist, the previous outcome, the objective, the score, the round and the stop", async () => {
    const { events } = await runAgentLab(revising, { paceMs: 0 });
    const list = payloads(events);
    const [first, second] = ofType(list, "lab_conflict_detected");
    expect(first).toMatchObject({ round: 1, infeasible: false });
    expect(first!.conflicts.map((conflict) => conflict.agent)).toEqual(["transport"]);
    expect(first!.conflicts[0]!.reason).toMatch(/over budget/);
    expect(first!.score).toBeGreaterThan(0);
    expect(second).toMatchObject({ round: 2, conflicts: [], score: 0 });

    const [started] = ofType(list, "lab_revision_started");
    expect(started).toMatchObject({ round: 2, agent: "transport" });
    expect(started!.objective).toMatch(/^Fix: .*over budget/);
    expect(started!.previousOutcome).toMatch(/AUD 1680/);

    const [scored] = ofType(list, "lab_revision_scored");
    expect(scored).toMatchObject({ round: 2, kept: true, scoreAfter: 0 });
    expect(scored!.scoreBefore).toBe(first!.score);

    expect(ofType(list, "lab_loop_stopped")).toMatchObject([
      { round: 2, reason: "converged", unresolved: 0 },
    ]);
  });

  it("does not rerun specialists the conflict did not name", async () => {
    const { events } = await runAgentLab(revising, { paceMs: 0 });
    const secondRound = payloads(events).filter(
      (event) => event.type === "agent_started" && event.round === 2,
    );
    expect(secondRound.map((event: any) => event.agent)).toEqual(["transport"]);
  });

  it("adds no round and leaves the plan alone when there is no conflict", async () => {
    const request = { ...revising, scenarioId: "tokyo-couple" } as const;
    const [without, withRevision] = [
      await runAgentLab({ ...request, strategyId: "multi-agent-no-revision" }, { paceMs: 0 }),
      await runAgentLab(request, { paceMs: 0 }),
    ];
    expect(withRevision.plan).toEqual(without.plan);
    expect(withRevision.metrics.rounds).toBe(1);
    expect(ofType(payloads(withRevision.events), "lab_loop_stopped")).toMatchObject([
      { round: 1, reason: "converged", unresolved: 0 },
    ]);
    expect(ofType(payloads(withRevision.events), "lab_revision_started")).toEqual([]);
    expect(base.brief.budgetTotal).toBeGreaterThan(tight.brief.budgetTotal);
  });

  it("stops without revising when the budget is infeasible", async () => {
    const infeasible = { ...tight, brief: { ...tight.brief, budgetTotal: 2100 } };
    const emitted: AgentLabEventPayload[] = [];
    const plan = await createMultiAgentFixtureStrategy({ revise: true }).run({
      scenario: infeasible,
      signal: new AbortController().signal,
      emit: async (event) => void emitted.push(event),
    });
    expect(ofType(emitted, "lab_conflict_detected")[0]).toMatchObject({ infeasible: true });
    expect(ofType(emitted, "lab_revision_started")).toEqual([]);
    expect(ofType(emitted, "lab_loop_stopped")).toMatchObject([
      { round: 1, reason: "infeasible_budget" },
    ]);
    expect(plan.round).toBe(1);
  });
});

describe("bounded loop with controlled specialists", () => {
  const proposal = (agent: AgentName, cost: number, floor: number): AgentProposal => ({
    agent,
    summary: `${agent} at ${cost}`,
    items: [{ kind: "estimate", detail: "Option", estCost: cost }],
    assumptions: [],
    conflictsWith: [],
    floorCost: floor,
    source: { kind: "mock", label: "test", freshness: "test" },
  });
  const specialists = (revised: number[]): Specialist[] => {
    let n = 0;
    const make = (
      name: AgentName,
      label: string,
      initial: number,
      floor: number,
      revise: boolean,
    ): Specialist => ({
      name,
      label,
      supportsRevision: revise,
      invoke: async (request: SpecialistRequest) =>
        request.revision
          ? proposal(name, revised[Math.min(n++, revised.length - 1)]!, floor)
          : proposal(name, initial, floor),
    });
    return [
      make("transport", "Getting around", 1700, 800, true),
      make("accommodation", "Stay", 600, 600, false),
    ];
  };

  const run = async (revised: number[]) => {
    const emitted: AgentLabEventPayload[] = [];
    const plan = await createMultiAgentFixtureStrategy({
      revise: true,
      specialists: specialists(revised),
    }).run({
      scenario: { ...tight, brief: { ...tight.brief, budgetTotal: 2000 } },
      signal: new AbortController().signal,
      emit: async (event) => void emitted.push(event),
    });
    return { plan, emitted };
  };

  it("keeps the best known proposals and stops when a revision does not improve", async () => {
    const { plan, emitted } = await run([1700]);
    expect(ofType(emitted, "lab_revision_scored")[0]).toMatchObject({ kept: false });
    expect(ofType(emitted, "lab_loop_stopped")).toMatchObject([
      { round: 2, reason: "no_improvement" },
    ]);
    expect(plan.estTotal).toBe(2300);
  });

  it("stops at the round limit instead of looping", async () => {
    const { plan, emitted } = await run([1650, 1620, 1600, 1580]);
    expect(plan.round).toBeLessThanOrEqual(3);
    expect(ofType(emitted, "lab_loop_stopped")).toMatchObject([
      { round: 3, reason: "round_limit" },
    ]);
  });
});
