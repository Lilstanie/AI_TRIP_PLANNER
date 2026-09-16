import {
  END,
  START,
  StateGraph,
  StateSchema,
  type ConditionalEdgeRouter,
  type GraphNode,
} from "@langchain/langgraph";
import { allSpecialists } from "@trip/agents";
import { memory } from "@trip/services";
import {
  AgentProposal as AgentProposalSchema,
  TripBrief as TripBriefSchema,
  TripPlan as TripPlanSchema,
  type AgentContext,
  type AgentProposal,
  type AgentProgressEvent,
  type AgentName,
  type HitlCheckpoint,
  type HitlDecision,
  type MemoryStore,
  type RevisionRequest,
  type Specialist,
  type ToolGateway,
  type TripBrief,
  type TripPlan,
  type TripSection,
} from "@trip/shared";
import { createToolGateway } from "@trip/tools";
import { z } from "zod/v4";
import { assessBudget, costOf, ESCALATION_OVERRUN_PCT, NEGOTIATION_OVERRUN_PCT } from "./budget";
import { dispatchWithSupervisor, reviseWithSupervisor } from "./supervisor";

const DEFAULT_MAX_ROUNDS = 3;

/** Dependencies are injectable so the graph can be tested without network or singleton state. */
export interface OrchestratorOptions {
  specialists?: Specialist[];
  tools?: ToolGateway;
  mem?: MemoryStore;
  maxRounds?: number;
  onProgress?: (event: AgentProgressEvent) => void;
  // Decisions the human has already made on this trip's HITL checkpoints.
  // Pure projection input: it never changes what the specialists negotiate,
  // only how the resulting plan's `hitl`/section statuses are reported.
  decisions?: HitlDecision[];
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
  specialistByName: Map<Specialist["name"], Specialist>,
  planConfirmed: boolean,
  escalationOverridden: boolean,
): TripSection {
  // Approving the escalation checkpoint is the human explicitly saying "ship
  // it anyway" — the underlying conflict never actually resolved, but it must
  // no longer block the section as "needs_you", or the override is theater.
  const stillConflicting =
    unresolved.some((request) => request.targetAgent === proposal.agent) && !escalationOverridden;
  const status = stillConflicting ? "needs_you" : planConfirmed ? "confirmed" : "draft";
  return {
    id: proposal.agent,
    label: specialistByName.get(proposal.agent)?.label ?? proposal.agent,
    summary: proposal.summary,
    status,
    estCost: costOf(proposal),
    proposal,
  };
}

/**
 * A decision only ever resolves the one checkpoint it names — it ignores
 * every other id. This is what makes it safe for a decision to survive on
 * the client past the point its checkpoint stops being generated (e.g. the
 * brief changed): applying it here is a harmless no-op instead of an error.
 */
function statusFor(
  checkpointId: string,
  decisions: HitlDecision[],
): HitlCheckpoint["status"] {
  const decision = decisions.find((entry) => entry.checkpointId === checkpointId);
  if (!decision) return "pending";
  return decision.decision === "approve" ? "approved" : "rejected";
}

function buildHitl(
  brief: TripBrief,
  overrunPct: number,
  unresolved: boolean,
  maxRounds: number,
  round: number,
  decisions: HitlDecision[],
): HitlCheckpoint[] {
  const items: HitlCheckpoint[] = [
    {
      id: "confirm-brief",
      type: "confirm_brief",
      title: "Confirm your trip basics",
      detail: `${brief.destination} · ${brief.dates[0]} to ${brief.dates[1]} · ${brief.groupSize} people · $${brief.budgetTotal}`,
      status: statusFor("confirm-brief", decisions),
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
      status: statusFor("escalation", decisions),
    });
  } else {
    // Nothing needs escalating — the plan converged under budget, so the only
    // decision left is the human's final sign-off before sections show as
    // "confirmed" rather than just "draft".
    items.push({
      id: "confirm-plan",
      type: "confirm_plan",
      title: "Confirm this plan",
      detail: `Converged in round ${round} at USD ${brief.budgetTotal} budget (${overrunPct <= 0 ? "under" : "at"} budget). Approve to lock it in.`,
      status: statusFor("confirm-plan", decisions),
    });
  }
  return items;
}

function resolveOptions(options: OrchestratorOptions) {
  const injected = options.specialists !== undefined;
  const specialists = options.specialists ?? allSpecialists;
  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;
  if (!Number.isSafeInteger(maxRounds) || maxRounds < 1) {
    throw new Error("Orchestrator maxRounds must be a positive integer.");
  }
  if (specialists.length === 0) throw new Error("Orchestrator requires at least one specialist.");

  const specialistByName = new Map(specialists.map((specialist) => [specialist.name, specialist]));
  if (specialistByName.size !== specialists.length) {
    throw new Error("Orchestrator specialist names must be unique.");
  }

  return {
    specialists,
    specialistByName,
    injected,
    maxRounds,
    tools: options.tools ?? createToolGateway(),
    mem: options.mem ?? memory,
    onProgress: options.onProgress,
    decisions: options.decisions ?? [],
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
  const { specialists, specialistByName, injected, maxRounds, tools, mem, onProgress, decisions } =
    resolveOptions(options);

  const context = (brief: TripBrief, round: number): AgentContext => ({
    tripId: brief.tripId,
    round,
    tools,
    mem,
  });

  const invokeSpecialist = async (
    specialist: Specialist,
    request: Parameters<Specialist["invoke"]>[0],
  ): Promise<AgentProposal> => {
    onProgress?.({ type: "agent_started", agent: specialist.name, round: request.context.round });
    try {
      const proposal = AgentProposalSchema.parse(await specialist.invoke(request));
      onProgress?.({
        type: "agent_completed",
        agent: specialist.name,
        round: request.context.round,
      });
      return proposal;
    } catch (error) {
      onProgress?.({
        type: "agent_failed",
        agent: specialist.name,
        round: request.context.round,
        error: error instanceof Error ? error.message : "unknown agent error",
      });
      throw error;
    }
  };

  const dispatchSpecialists: WorkflowNode = async (state) => {
    const round = 1;
    const agentContext = context(state.brief, round);
    let proposals: AgentProposal[];
    // Explicit specialist injection is the deterministic seam used by tests.
    // Production uses the supervisor to select named specialist tools.
    if (injected) {
      proposals = await Promise.all(
        specialists.map((specialist) =>
          invokeSpecialist(specialist, { brief: state.brief, context: agentContext }),
        ),
      );
    } else {
      try {
        proposals = await dispatchWithSupervisor({
          brief: state.brief,
          specialists,
          context: agentContext,
          onProgress,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown supervisor error";
        console.warn(
          `[supervisor] Delegation unavailable; using deterministic dispatch: ${reason}`,
        );
        proposals = await Promise.all(
          specialists.map((specialist) =>
            invokeSpecialist(specialist, { brief: state.brief, context: agentContext }),
          ),
        );
      }
    }
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
    const deterministicRevision = () =>
      Promise.all(
        state.proposals.map(async (proposal) => {
          const request = requestByAgent.get(proposal.agent);
          const specialist = specialistByName.get(proposal.agent);
          if (!request || !specialist?.supportsRevision) return proposal;
          return invokeSpecialist(specialist, {
            brief: state.brief,
            context: context(state.brief, round),
            revision: request,
          });
        }),
      );
    let proposals: AgentProposal[];
    if (injected) {
      proposals = await deterministicRevision();
    } else {
      try {
        proposals = await reviseWithSupervisor({
          brief: state.brief,
          specialists,
          context: context(state.brief, round),
          proposals: state.proposals,
          requests: state.conflicts,
          onProgress,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown revision supervisor error";
        console.warn(
          `[supervisor] Revision delegation unavailable; using deterministic routing: ${reason}`,
        );
        proposals = await deterministicRevision();
      }
    }
    return { round, proposals };
  };

  const buildPlan: WorkflowNode = (state) => {
    const unresolved = state.conflicts.length > 0;
    // Computed straight from the proposals (not the sections) because building
    // the sections themselves now needs to know whether confirm-plan was
    // approved — hitl has to exist first.
    const { estTotal, overrunPct } = assessBudget(
      state.proposals.map(costOf),
      state.brief.budgetTotal,
    );
    const hitl = buildHitl(state.brief, overrunPct, unresolved, maxRounds, state.round, decisions);
    const planConfirmed = hitl.some(
      (checkpoint) => checkpoint.type === "confirm_plan" && checkpoint.status === "approved",
    );
    const escalationOverridden = hitl.some(
      (checkpoint) => checkpoint.type === "escalation" && checkpoint.status === "approved",
    );
    const sections = state.proposals.map((proposal) =>
      toSection(proposal, state.conflicts, specialistByName, planConfirmed, escalationOverridden),
    );
    const plan: TripPlan = {
      tripId: state.brief.tripId,
      brief: state.brief,
      round: state.round,
      budgetTotal: state.brief.budgetTotal,
      estTotal,
      overrunPct,
      sections,
      hitl,
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
  const result = await createOrchestratorGraph(options).invoke({
    brief: TripBriefSchema.parse(brief),
  });
  if (!result.plan) throw new Error("Orchestrator graph finished without a trip plan.");
  return TripPlanSchema.parse(result.plan);
}
