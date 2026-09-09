import {
  END,
  START,
  StateGraph,
  StateSchema,
  type ConditionalEdgeRouter,
  type GraphNode,
} from "@langchain/langgraph";
import { allAgents } from "@trip/agents";
import { memory } from "@trip/services";
import {
  AgentProposal as AgentProposalSchema,
  TripBrief as TripBriefSchema,
  TripPlan as TripPlanSchema,
  type Agent,
  type AgentContext,
  type AgentProposal,
  type AgentName,
  type HitlCheckpoint,
  type MemoryStore,
  type RevisionRequest,
  type ToolGateway,
  type TripBrief,
  type TripPlan,
  type TripSection,
} from "@trip/shared";
import { createToolGateway } from "@trip/tools";
import { z } from "zod/v4";
import {
  assessBudget,
  costOf,
  rollUpCost,
  ESCALATION_OVERRUN_PCT,
  NEGOTIATION_OVERRUN_PCT,
} from "./budget";

const DEFAULT_MAX_ROUNDS = 3;

/** Dependencies are injectable so the graph can be tested without network or singleton state. */
export interface OrchestratorOptions {
  agents?: Agent[];
  tools?: ToolGateway;
  mem?: MemoryStore;
  maxRounds?: number;
}

const OrchestratorState = new StateSchema({
  // The shared package still exposes Zod v3 contracts. LangGraph's recommended
  // StateSchema uses Zod v4 fields, so public values are parsed at graph boundaries
  // and represented as typed custom fields while the migration remains local.
  brief: z.custom<TripBrief>(),
  round: z.number().int().nonnegative().default(0),
  proposals: z.array(z.custom<AgentProposal>()).default(() => []),
  conflicts: z.array(z.custom<RevisionRequest>()).default(() => []),
  plan: z.custom<TripPlan>().optional(),
});

type WorkflowNode = GraphNode<typeof OrchestratorState>;

export function detectConflicts(proposals: AgentProposal[], brief: TripBrief): RevisionRequest[] {
  const { overrunPct } = assessBudget(proposals.map(costOf), brief.budgetTotal);
  const pending = new Map<AgentName, { reasons: string[]; constraints: string[] }>();
  const add = (agent: AgentName, reason: string, constraint: string) => {
    const entry = pending.get(agent) ?? { reasons: [], constraints: [] };
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    if (!entry.constraints.includes(constraint)) entry.constraints.push(constraint);
    pending.set(agent, entry);
  };

  if (overrunPct > NEGOTIATION_OVERRUN_PCT) {
    [...proposals]
      .filter((proposal) => costOf(proposal) > 0)
      .sort((left, right) => costOf(right) - costOf(left))
      .slice(0, 2)
      .forEach((proposal) =>
        add(
          proposal.agent,
          `plan is ${overrunPct.toFixed(2)}% over budget`,
          `cut ${proposal.agent} cost by ~30%`,
        ),
      );
  }

  for (const proposal of proposals) {
    for (const reason of proposal.conflictsWith) {
      add(proposal.agent, reason, "make the route geographically feasible");
    }
  }

  const scheduled = proposals.flatMap((proposal) =>
    proposal.items.flatMap((item) =>
      item.day !== undefined && item.startTime && item.endTime
        ? [{ agent: proposal.agent, item }]
        : [],
    ),
  );
  const toMinutes = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour! * 60 + minute!;
  };
  for (let leftIndex = 0; leftIndex < scheduled.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < scheduled.length; rightIndex += 1) {
      const left = scheduled[leftIndex]!;
      const right = scheduled[rightIndex]!;
      if (left.item.day !== right.item.day) continue;
      const overlaps =
        toMinutes(left.item.startTime!) < toMinutes(right.item.endTime!) &&
        toMinutes(right.item.startTime!) < toMinutes(left.item.endTime!);
      if (!overlaps) continue;
      const targets =
        left.agent === "itinerary" || right.agent === "itinerary"
          ? (["itinerary"] as const)
          : ([left.agent, right.agent] as const);
      const reason = `time overlap on day ${left.item.day}: ${left.item.startTime}-${left.item.endTime} conflicts with ${right.item.startTime}-${right.item.endTime}`;
      for (const target of new Set<AgentName>(targets)) {
        // A revising agent only sees its own proposal, so name the window it has
        // to work around and who owns it. Without this it is guessing, and the
        // graph burns every remaining round without converging.
        const blocker = target === left.agent ? right : left;
        add(
          target,
          reason,
          `on day ${left.item.day} keep clear of ${blocker.item.startTime}-${blocker.item.endTime}, held by ${blocker.agent}${
            blocker.item.location ? ` (${blocker.item.location})` : ""
          }; reschedule without changing trip dates`,
        );
      }
    }
  }

  return [...pending].map(([targetAgent, value]) => ({
    tripId: brief.tripId,
    targetAgent,
    reason: value.reasons.join("; "),
    constraints: value.constraints,
  }));
}

function toSection(
  proposal: AgentProposal,
  unresolved: RevisionRequest[],
  agentByName: Map<Agent["name"], Agent>,
): TripSection {
  const stillConflicting = unresolved.some((request) => request.targetAgent === proposal.agent);
  return {
    id: proposal.agent,
    label: agentByName.get(proposal.agent)?.label ?? proposal.agent,
    summary: proposal.summary,
    status: stillConflicting ? "needs_you" : "draft",
    estCost: costOf(proposal),
    proposal,
  };
}

function buildHitl(
  brief: TripBrief,
  overrunPct: number,
  unresolved: boolean,
  maxRounds: number,
): HitlCheckpoint[] {
  const items: HitlCheckpoint[] = [
    {
      id: "confirm-brief",
      type: "confirm_brief",
      title: "Confirm your trip basics",
      detail: `${brief.destination} · ${brief.dates[0]} to ${brief.dates[1]} · ${brief.groupSize} people · $${brief.budgetTotal}`,
      status: "pending",
    },
  ];

  if (overrunPct > ESCALATION_OVERRUN_PCT || unresolved) {
    items.push({
      id: "escalation",
      type: "escalation",
      title: "Needs a human decision",
      detail: unresolved
        ? `Agents did not converge within ${maxRounds} rounds.`
        : `Plan is ${overrunPct.toFixed(2)}% over budget.`,
      status: "pending",
    });
  }
  return items;
}

function resolveOptions(options: OrchestratorOptions) {
  const agents = options.agents ?? allAgents;
  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;
  if (!Number.isSafeInteger(maxRounds) || maxRounds < 1) {
    throw new Error("Orchestrator maxRounds must be a positive integer.");
  }
  if (agents.length === 0) throw new Error("Orchestrator requires at least one agent.");

  const agentByName = new Map(agents.map((agent) => [agent.name, agent]));
  if (agentByName.size !== agents.length) {
    throw new Error("Orchestrator agent names must be unique.");
  }

  return {
    agents,
    agentByName,
    maxRounds,
    tools: options.tools ?? createToolGateway(),
    mem: options.mem ?? memory,
  };
}

/**
 * Build a fresh compiled graph for one dependency set.
 *
 * START -> dispatch_specialists -> detect_conflicts
 *                                      | (conditional)
 *                         revise_conflicts <-> detect_conflicts
 *                                      |
 *                                 build_plan -> END
 */
export function createOrchestratorGraph(options: OrchestratorOptions = {}) {
  const { agents, agentByName, maxRounds, tools, mem } = resolveOptions(options);

  const context = (brief: TripBrief, round: number): AgentContext => ({
    tripId: brief.tripId,
    round,
    tools,
    mem,
  });

  const dispatchSpecialists: WorkflowNode = async (state) => {
    const round = 1;
    const proposals = await Promise.all(
      agents.map((agent) => agent.run(state.brief, context(state.brief, round))),
    );
    return { round, proposals: proposals.map((proposal) => AgentProposalSchema.parse(proposal)) };
  };

  const detectProposalConflicts: WorkflowNode = (state) => ({
    conflicts: detectConflicts(state.proposals, state.brief),
  });

  const reviseConflicts: WorkflowNode = async (state) => {
    const round = state.round + 1;
    const requestByAgent = new Map(
      state.conflicts.map((request) => [request.targetAgent, request]),
    );
    const proposals = await Promise.all(
      state.proposals.map(async (proposal) => {
        const request = requestByAgent.get(proposal.agent);
        const agent = agentByName.get(proposal.agent);
        if (!request || !agent?.revise) return proposal;
        const revised = await agent.revise(state.brief, context(state.brief, round), request);
        return AgentProposalSchema.parse(revised);
      }),
    );
    return { round, proposals };
  };

  const buildPlan: WorkflowNode = (state) => {
    const unresolved = state.conflicts.length > 0;
    const sections = state.proposals.map((proposal) =>
      toSection(proposal, state.conflicts, agentByName),
    );
    const { estTotal, overrunPct } = rollUpCost(sections, state.brief.budgetTotal);
    const plan: TripPlan = {
      tripId: state.brief.tripId,
      brief: state.brief,
      round: state.round,
      budgetTotal: state.brief.budgetTotal,
      estTotal,
      overrunPct,
      sections,
      hitl: buildHitl(state.brief, overrunPct, unresolved, maxRounds),
    };
    return { plan: TripPlanSchema.parse(plan) };
  };

  const routeAfterDetection: ConditionalEdgeRouter<
    typeof OrchestratorState,
    Record<string, unknown>,
    "revise_conflicts" | "build_plan"
  > = (state) =>
    state.conflicts.length > 0 && state.round < maxRounds ? "revise_conflicts" : "build_plan";

  return new StateGraph(OrchestratorState)
    .addNode("dispatch_specialists", dispatchSpecialists)
    .addNode("detect_conflicts", detectProposalConflicts)
    .addNode("revise_conflicts", reviseConflicts)
    .addNode("build_plan", buildPlan)
    .addEdge(START, "dispatch_specialists")
    .addEdge("dispatch_specialists", "detect_conflicts")
    .addConditionalEdges("detect_conflicts", routeAfterDetection, [
      "revise_conflicts",
      "build_plan",
    ])
    .addEdge("revise_conflicts", "detect_conflicts")
    .addEdge("build_plan", END)
    .compile();
}

export async function runOrchestrator(
  brief: TripBrief,
  options: OrchestratorOptions = {},
): Promise<TripPlan> {
  const mem = options.mem ?? memory;
  const result = await createOrchestratorGraph({ ...options, mem }).invoke({
    brief: TripBriefSchema.parse(brief),
  });
  if (!result.plan) throw new Error("Orchestrator graph finished without a trip plan.");
  const plan = TripPlanSchema.parse(result.plan);
  const decisions = (await mem.getHitlDecisions?.(plan.tripId)) ?? [];
  if (decisions.length === 0) return plan;
  const byId = new Map(decisions.map((decision) => [decision.checkpointId, decision.status]));
  return TripPlanSchema.parse({
    ...plan,
    hitl: plan.hitl.map((checkpoint) => ({
      ...checkpoint,
      status: byId.get(checkpoint.id) ?? checkpoint.status,
    })),
  });
}

export async function recordHitlDecision(
  tripId: string,
  decision: import("@trip/shared").HitlDecision,
  mem: MemoryStore = memory,
): Promise<void> {
  if (!mem.setHitlDecision) throw new Error("This memory store does not support HITL decisions.");
  await mem.setHitlDecision(tripId, decision);
}
