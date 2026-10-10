import { describe, expect, it, vi } from "vitest";
import type {
  AgentName,
  AgentProposal,
  MemoryStore,
  Specialist,
  SpecialistRequest,
  ToolGateway,
  TripBrief,
} from "@trip/shared";
import { runOrchestrator, type WorkflowDecision } from "../src";

const brief = (budgetTotal: number): TripBrief => ({
  tripId: "decisions",
  userId: "u",
  destination: "Sydney",
  dates: ["2026-10-01", "2026-10-04"],
  groupSize: 2,
  budgetTotal,
});

const tools = { maps: {}, booking: {} } as unknown as ToolGateway;
const mem: MemoryStore = {
  getShortTerm: async () => [],
  appendShortTerm: async () => {},
  getLongTerm: async () => [],
  setLongTerm: async () => {},
  promote: async () => {},
};

function proposal(agent: AgentName, cost: number, floorCost: number): AgentProposal {
  return {
    agent,
    summary: `${agent} at ${cost}`,
    items: [{ kind: "estimate", detail: "Selected option", estCost: cost }],
    assumptions: [],
    conflictsWith: [],
    floorCost,
  };
}

function specialist(
  name: AgentName,
  initial: number,
  floor: number,
  revisedCosts: number[] = [],
): Specialist & { invoke: ReturnType<typeof vi.fn> } {
  let revisions = 0;
  return {
    name,
    label: name,
    supportsRevision: revisedCosts.length > 0,
    invoke: vi.fn(async (request: SpecialistRequest) =>
      request.revision
        ? proposal(name, revisedCosts[Math.min(revisions++, revisedCosts.length - 1)]!, floor)
        : proposal(name, initial, floor),
    ),
  };
}

async function run(budget: number, specialists: Specialist[], maxRounds = 3) {
  const decisions: WorkflowDecision[] = [];
  const plan = await runOrchestrator(brief(budget), {
    specialists,
    tools,
    mem,
    maxRounds,
    onDecision: (decision) => decisions.push(decision),
  });
  return { plan, decisions };
}

const of = <T extends WorkflowDecision["type"]>(decisions: WorkflowDecision[], type: T) =>
  decisions.filter((decision) => decision.type === type) as Extract<
    WorkflowDecision,
    { type: T }
  >[];

describe("workflow decisions", () => {
  it("names the conflict, the targeted specialist and the score, then converges", async () => {
    const transport = specialist("transport", 900, 300, [600]);
    const stay = specialist("accommodation", 300, 300);
    const { plan, decisions } = await run(1000, [transport, stay]);

    const [first, second] = of(decisions, "conflicts_detected");
    expect(first).toMatchObject({ round: 1, infeasible: false });
    expect(first!.conflicts.map((conflict) => conflict.agent)).toEqual(["transport"]);
    expect(first!.conflicts[0]!.reason).toMatch(/over budget/);
    expect(first!.conflicts[0]!.targetSaving).toBe(200);
    expect(first!.score).toBe(200);
    expect(second).toMatchObject({ round: 2, conflicts: [], score: 0 });

    const [started] = of(decisions, "revision_started");
    expect(started).toMatchObject({ round: 2, agent: "transport", previousCost: 900 });
    expect(started!.previousSummary).toBe("transport at 900");
    expect(started!.objective).toMatch(/over budget/);

    const [scored] = of(decisions, "revision_scored");
    expect(scored).toMatchObject({ round: 2, scoreBefore: 200, scoreAfter: 0, kept: true });
    expect(of(decisions, "loop_stopped")).toEqual([
      { type: "loop_stopped", round: 2, reason: "converged", unresolved: 0 },
    ]);
    expect(plan.estTotal).toBe(900);
  });

  it("does not invoke a specialist the conflict did not name", async () => {
    const transport = specialist("transport", 900, 300, [600]);
    const stay = specialist("accommodation", 300, 300);
    const dining = specialist("dining", 0, 0);
    await run(1000, [transport, stay, dining]);
    expect(transport.invoke).toHaveBeenCalledTimes(2);
    expect(stay.invoke).toHaveBeenCalledTimes(1);
    expect(dining.invoke).toHaveBeenCalledTimes(1);
  });

  it("keeps the best known proposals and stops when a revision does not improve", async () => {
    const transport = specialist("transport", 900, 300, [900]);
    const stay = specialist("accommodation", 300, 300);
    const { plan, decisions } = await run(1000, [transport, stay]);
    expect(of(decisions, "revision_scored")[0]).toMatchObject({
      scoreBefore: 200,
      scoreAfter: 200,
      kept: false,
    });
    expect(of(decisions, "loop_stopped")).toEqual([
      { type: "loop_stopped", round: 2, reason: "no_improvement", unresolved: 1 },
    ]);
    expect(transport.invoke).toHaveBeenCalledTimes(2);
    expect(plan.estTotal).toBe(1200);
    expect(plan.conflicts).toHaveLength(1);
  });

  it("stops at the round limit with the conflict still unresolved", async () => {
    const transport = specialist("transport", 900, 300, [850]);
    const stay = specialist("accommodation", 300, 300);
    const { plan, decisions } = await run(1000, [transport, stay], 2);
    expect(of(decisions, "loop_stopped")).toEqual([
      { type: "loop_stopped", round: 2, reason: "round_limit", unresolved: 1 },
    ]);
    expect(plan.round).toBe(2);
  });

  it("stops without revising when even the cheapest options exceed the budget", async () => {
    const transport = specialist("transport", 900, 300, [600]);
    const stay = specialist("accommodation", 300, 300);
    const { decisions } = await run(500, [transport, stay]);
    expect(of(decisions, "conflicts_detected")[0]).toMatchObject({ infeasible: true });
    expect(of(decisions, "revision_started")).toEqual([]);
    expect(of(decisions, "loop_stopped")).toEqual([
      { type: "loop_stopped", round: 1, reason: "infeasible_budget", unresolved: 1 },
    ]);
    expect(transport.invoke).toHaveBeenCalledTimes(1);
  });

  it("reports a converged first round as zero conflicts and the same plan with or without the hook", async () => {
    const make = () => [specialist("transport", 300, 300), specialist("accommodation", 300, 300)];
    const { plan, decisions } = await run(1000, make());
    expect(of(decisions, "loop_stopped")).toEqual([
      { type: "loop_stopped", round: 1, reason: "converged", unresolved: 0 },
    ]);
    const bare = await runOrchestrator(brief(1000), { specialists: make(), tools, mem });
    expect(bare).toEqual(plan);
  });

  it("does not let a throwing consumer take the plan down", async () => {
    const plan = await runOrchestrator(brief(1000), {
      specialists: [specialist("transport", 300, 300)],
      tools,
      mem,
      onDecision: () => {
        throw new Error("consumer bug");
      },
    });
    expect(plan.estTotal).toBe(300);
  });
});
