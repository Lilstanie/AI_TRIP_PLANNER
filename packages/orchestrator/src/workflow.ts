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
  type AgentName,
  type AgentProposal,
  type AgentProgressEvent,
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
import { assessBudget, costOf, rollUpCost, NEGOTIATION_OVERRUN_PCT } from "./budget";
import { detectConflicts } from "./conflicts";
export { detectConflicts } from "./conflicts";
import { choiceFor, dispatchWithSupervisor, reviseWithSupervisor } from "./supervisor";
import { withProgressTools } from "./progress-tools";

const DEFAULT_MAX_ROUNDS = 3;

/** Dependencies are injectable so the graph can be tested without network or singleton state. */
export interface OrchestratorOptions {
  specialists?: Specialist[];
  tools?: ToolGateway;
  mem?: MemoryStore;
  maxRounds?: number;
  onProgress?: (event: AgentProgressEvent) => void;
}

const OrchestratorState = new StateSchema({
  // Public contracts are validated at graph boundaries; custom state fields
  // keep the graph representation independent of the shared schema internals.
  brief: z.custom<TripBrief>(),
  round: z.number().int().nonnegative().default(0),
  proposals: z.array(z.custom<AgentProposal>()).default(() => []),
  conflicts: z.array(z.custom<RevisionRequest>()).default(() => []),
  plan: z.custom<TripPlan>().optional(),
});

type WorkflowNode = GraphNode<typeof OrchestratorState>;

function toSection(
  proposal: AgentProposal,
  unresolved: RevisionRequest[],
  specialistByName: Map<Specialist["name"], Specialist>,
): TripSection {
  // A section is "needs_you" exactly while an unresolved revision request still
  // targets it, and "draft" once it has a proposal and no conflict. Nothing else
  // can move a section out of one of those states any more: there is no
  // confirmation step, so "confirmed" is never produced here.
  const stillConflicting = unresolved.some((request) => request.targetAgent === proposal.agent);
  return {
    id: proposal.agent,
    label: specialistByName.get(proposal.agent)?.label ?? proposal.agent,
    summary: proposal.summary,
    status: stillConflicting ? "needs_you" : "draft",
    estCost: costOf(proposal),
    proposal,
  };
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
  const { specialists, specialistByName, injected, maxRounds, tools, mem, onProgress } =
    resolveOptions(options);

  const context = (brief: TripBrief, round: number, agent?: AgentName): AgentContext => ({
    tripId: brief.tripId,
    round,
    tools: agent && onProgress ? withProgressTools(tools, agent, round, onProgress) : tools,
    mem: brief.accommodation
      ? {
          ...mem,
          getLongTerm: async (userId) => [
            ...(await mem.getLongTerm(userId)).filter((p) => !p.key.startsWith("accommodation.")),
            ...Object.entries(brief.accommodation!).map(([key, value]) => ({
              key: `accommodation.${key}`,
              value: String(value),
              source: "filter" as const,
            })),
          ],
        }
      : mem,
  });

  const invokeSpecialist = async (
    specialist: Specialist,
    request: Parameters<Specialist["invoke"]>[0],
  ): Promise<AgentProposal> => {
    onProgress?.({
      type: "agent_started",
      agent: specialist.name,
      round: request.context.round,
      summary: `${request.brief.destination} · ${request.brief.dates.join(" to ")} · ${request.brief.groupSize} people · AUD ${request.brief.budgetTotal}`,
      objective: request.revision
        ? `Fix: ${request.revision.reason}`
        : `Produce the ${specialist.label} section for this trip.`,
      constraints: request.revision?.constraints,
    });
    try {
      const proposal = AgentProposalSchema.parse(await specialist.invoke(request));
      onProgress?.({
        summary: proposal.summary,
        outcome: request.revision
          ? `Revised ${proposal.agent} after: ${request.revision.reason}.`
          : `Produced ${proposal.agent} section.`,
        ...(choiceFor(proposal) ? { choice: choiceFor(proposal)! } : {}),
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
        error: "This specialist could not finish. Retry the request.",
      });
      throw error;
    }
  };

  const dispatchSpecialists: WorkflowNode = async (state) => {
    const round = 1;
    onProgress?.({
      type: "coordinator",
      phase: "dispatch",
      round,
      summary: `Assigning planning tasks for ${state.brief.destination}.`,
    });
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

  const detectProposalConflicts: WorkflowNode = (state) => {
    const conflicts = detectConflicts(state.proposals, state.brief);
    onProgress?.({
      type: "coordinator",
      phase: "conflicts",
      round: state.round,
      summary: `Checked budget and schedules: ${conflicts.length} revision request(s).`,
      constraints: conflicts.flatMap((c) => c.constraints),
    });
    return { conflicts };
  };

  const reviseConflicts: WorkflowNode = async (state) => {
    const round = state.round + 1;
    onProgress?.({
      type: "coordinator",
      phase: "revision",
      round,
      summary: "Revising affected sections.",
      constraints: state.conflicts.flatMap((c) => c.constraints),
    });
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
            context: context(state.brief, round, specialist.name),
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
    onProgress?.({
      type: "coordinator",
      phase: "assembly",
      round: state.round,
      summary: "Assembling the plan.",
    });
    const sections = state.proposals.map((proposal) =>
      toSection(proposal, state.conflicts, specialistByName),
    );
    const { estTotal, overrunPct } = rollUpCost(sections, state.brief.budgetTotal);
    for (const section of sections) {
      if (section.proposal && !section.proposal.source)
        section.proposal.source = {
          kind: "unavailable",
          label: "Source not recorded",
          freshness:
            "This specialist did not report its provider or degradation state; treat the result as unverified.",
        };
    }
    const plan: TripPlan = {
      tripId: state.brief.tripId,
      brief: state.brief,
      round: state.round,
      budgetTotal: state.brief.budgetTotal,
      estTotal,
      overrunPct,
      sections,
      conflicts: state.conflicts,
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
