import {
  AgentProposal as AgentProposalSchema,
  type AgentContext,
  type AgentName,
  type AgentProposal,
  type AgentProgressEvent,
  type RevisionRequest,
  type Specialist,
  type ToolChoice,
  type TripBrief,
} from "@trip/shared";
import { createRoutedChatModel } from "@trip/agents";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { createAgent, tool } from "langchain";
import { z } from "zod/v4";
import { withProgressTools } from "./progress-tools";
import { createReasoningSink } from "./reasoning-sink";

/**
 * The stay a specialist settled on, as a transcript decision rather than prose.
 * Published on `agent_completed` so the transcript shows the choice and its
 * alternatives instead of asking the traveller to make it from scratch.
 */
export function choiceFor(proposal: AgentProposal): ToolChoice | undefined {
  const flight = proposal.flights?.[0];
  if (flight) {
    const selected = flight.candidates.find((candidate) => candidate.id === flight.selectedId);
    if (!selected) return undefined;
    const describe = (candidate: (typeof flight.candidates)[number]) =>
      [
        `AUD ${candidate.price.toFixed(2)} total`,
        candidate.stops === undefined
          ? undefined
          : candidate.stops === 0
            ? "Nonstop"
            : `${candidate.stops} stop${candidate.stops === 1 ? "" : "s"}`,
        candidate.durationMin
          ? `${Math.floor(candidate.durationMin / 60)}h ${candidate.durationMin % 60}m`
          : undefined,
      ]
        .filter(Boolean)
        .join(" · ");
    return {
      title: `Flight ${flight.from} → ${flight.to}`,
      selected: { label: selected.carrier, detail: describe(selected) },
      rationale: proposal.summary,
      alternatives: flight.candidates
        .filter((candidate) => candidate.id !== flight.selectedId)
        .map((candidate) => ({ label: candidate.carrier, detail: describe(candidate) })),
    };
  }
  const stay = proposal.stays?.[0];
  if (!stay) return undefined;
  const selected = stay.candidates.find((candidate) => candidate.id === stay.selectedId);
  if (!selected) return undefined;
  const cost = selected.pricePerNight * stay.nights * stay.rooms;
  return {
    title: `Stay in ${stay.city}`,
    selected: {
      label: selected.name,
      detail: [
        selected.area,
        `AUD ${cost.toFixed(2)} total`,
        `${selected.rating}/10`,
        selected.freeCancellation ? "Free cancellation" : "No free cancellation",
      ].join(" · "),
    },
    rationale: proposal.summary,
    alternatives: stay.candidates
      .filter((candidate) => candidate.id !== stay.selectedId)
      .map((candidate) => ({
        label: candidate.name,
        detail: [
          candidate.area,
          `AUD ${(candidate.pricePerNight * stay.nights * stay.rooms).toFixed(2)} total`,
          `${candidate.rating}/10`,
          candidate.freeCancellation ? "Free cancellation" : "No free cancellation",
        ].join(" · "),
      })),
  };
}

/** What changed in this round, read from the proposal the specialist returned. */
function outcomeFor(proposal: AgentProposal, revision: RevisionRequest | undefined): string {
  if (!revision) return `Produced ${proposal.agent} section.`;
  const constraints = revision.constraints.length ? ` under ${revision.constraints.join("; ")}` : "";
  return `Revised ${proposal.agent} after: ${revision.reason}${constraints}.`;
}

const DelegationRequest = z.object({
  objective: z
    .string()
    .trim()
    .min(1)
    .describe("The bounded planning objective for this specialist."),
});

/**
 * Specialists whose absence makes the result not a trip plan. Only itinerary qualifies today:
 * a trip with no day plan is not a trip, while a trip with no dining section is just a trip the
 * traveller eats their own way through. Add to this list when a domain becomes load-bearing,
 * not merely when it is usually wanted.
 */
export const DEFAULT_REQUIRED_AGENTS = ["itinerary"] as const satisfies readonly AgentName[];

export interface SupervisorDispatchOptions {
  brief: TripBrief;
  specialists: Specialist[];
  context: AgentContext;
  model?: BaseChatModel;
  /** Defaults to DEFAULT_REQUIRED_AGENTS; entries not offered as tools are ignored. */
  requiredAgents?: readonly AgentName[];
  onProgress?: (event: AgentProgressEvent) => void;
}

export interface SupervisorRevisionOptions extends SupervisorDispatchOptions {
  proposals: AgentProposal[];
  requests: RevisionRequest[];
}

/**
 * Typed specialist tools are deliberately built around the current run context.
 * The supervisor chooses which tools to call; it cannot alter the validated brief,
 * memory store or tool gateway passed to a specialist.
 */
export function createSupervisorTools(
  options: Omit<SupervisorDispatchOptions, "model">,
  onProposal: (proposal: AgentProposal) => void,
) {
  return options.specialists.map((specialist) =>
    tool(
      async ({ objective }) => {
        options.onProgress?.({
          summary: `${options.brief.destination} · ${options.brief.dates.join(" to ")} · ${options.brief.groupSize} people · AUD ${options.brief.budgetTotal}`,
          objective,
          type: "agent_started",
          agent: specialist.name,
          round: options.context.round,
        });
        let proposal: AgentProposal;
        try {
          proposal = AgentProposalSchema.parse(
            await specialist.invoke({
              brief: options.brief,
              context: {
                ...options.context,
                tools: options.onProgress
                  ? withProgressTools(
                      options.context.tools,
                      specialist.name,
                      options.context.round,
                      options.onProgress,
                    )
                  : options.context.tools,
              },
            }),
          );
        } catch (error) {
          options.onProgress?.({
            type: "agent_failed",
            agent: specialist.name,
            round: options.context.round,
            error: "This specialist could not finish. Retry the request.",
          });
          throw error;
        }
        options.onProgress?.({
          summary: proposal.summary,
          outcome: outcomeFor(proposal, undefined),
          ...(choiceFor(proposal) ? { choice: choiceFor(proposal)! } : {}),
          type: "agent_completed",
          agent: specialist.name,
          round: options.context.round,
        });
        onProposal(proposal);
        return { objective, proposal };
      },
      {
        name: `ask_${specialist.name.replaceAll("-", "_")}_specialist`,
        description: `Delegate a bounded task to the ${specialist.label} specialist. Use this when its domain is needed for the trip plan.`,
        schema: DelegationRequest,
      },
    ),
  );
}

/** Create one immutable, typed delegation tool for each targeted revision. */
export function createRevisionTools(
  options: Omit<SupervisorRevisionOptions, "model" | "proposals">,
  onProposal: (proposal: AgentProposal) => void,
) {
  const specialists = new Map(
    options.specialists.map((specialist) => [specialist.name, specialist]),
  );
  return options.requests.flatMap((request) => {
    const specialist = specialists.get(request.targetAgent);
    if (!specialist?.supportsRevision) return [];
    return [
      tool(
        async ({ objective }) => {
          options.onProgress?.({
            summary: `${options.brief.destination} · ${options.brief.dates.join(" to ")} · ${options.brief.groupSize} people · AUD ${options.brief.budgetTotal}`,
            objective,
            constraints: request.constraints,
            type: "agent_started",
            agent: specialist.name,
            round: options.context.round,
          });
          let proposal: AgentProposal;
          try {
            proposal = AgentProposalSchema.parse(
              await specialist.invoke({
                brief: options.brief,
                context: {
                  ...options.context,
                  tools: options.onProgress
                    ? withProgressTools(
                        options.context.tools,
                        specialist.name,
                        options.context.round,
                        options.onProgress,
                      )
                    : options.context.tools,
                },
                revision: request,
              }),
            );
          } catch (error) {
            options.onProgress?.({
              type: "agent_failed",
              agent: specialist.name,
              round: options.context.round,
              error: "This specialist could not finish. Retry the request.",
            });
            throw error;
          }
          options.onProgress?.({
            summary: proposal.summary,
            outcome: outcomeFor(proposal, request),
            ...(choiceFor(proposal) ? { choice: choiceFor(proposal)! } : {}),
            type: "agent_completed",
            agent: specialist.name,
            round: options.context.round,
          });
          if (proposal.agent !== request.targetAgent) {
            throw new Error(`Revision tool returned ${proposal.agent} for ${request.targetAgent}.`);
          }
          onProposal(proposal);
          return { objective, request, proposal };
        },
        {
          name: `revise_${request.targetAgent.replaceAll("-", "_")}_specialist`,
          description: `Send the validated conflict and constraints to the ${specialist.label} specialist. The request is immutable and already targets this specialist.`,
          schema: DelegationRequest,
        },
      ),
    ];
  });
}

/** Run a genuine LangChain supervisor tool loop and return only called specialists. */
export async function dispatchWithSupervisor(
  options: SupervisorDispatchOptions,
): Promise<AgentProposal[]> {
  const sink = createReasoningSink(options.context.round, options.onProgress, 0);
  // Thinking is on for the supervisor: choosing which specialists to delegate
  // to is the run's visible reasoning, and streaming it is the only way to show
  // it. A model injected by a test is used as-is.
  const model = options.model
    ? options.model
    : ((): BaseChatModel | undefined => {
        const routed = createRoutedChatModel("itinerary", { thinking: true });
        return routed ? sink.wrap(routed) : undefined;
      })();
  if (!model) throw new Error("Supervisor requires a configured routed chat model.");

  const proposals = new Map<AgentProposal["agent"], AgentProposal>();
  const tools = createSupervisorTools(options, (proposal) =>
    proposals.set(proposal.agent, proposal),
  );
  const supervisor = createAgent({
    name: "trip_planning_supervisor",
    model,
    tools,
    systemPrompt:
      "You are the trip-planning supervisor. Decide which specialist tools are needed for the user's requested plan, delegate bounded objectives, and do not perform specialist work yourself. For a complete new trip plan, consider day planning, inter-city transport, accommodation, destination guidance and dining. Day planning is not optional: always delegate to the itinerary specialist. Do not invent or modify trip facts. Stop after the necessary specialist tools have returned; the deterministic LangGraph workflow validates, reconciles and persists their proposals. Write each objective as one concrete sentence naming the trip facts it must respect, because the traveller reads it in the transcript while the specialist works. When the brief has a preferences list, carry each preference into the objective of every specialist it bears on. Never ask the traveller a question yourself; the coordinator owns questions.",
  });

  try {
    await supervisor.invoke({
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            task: "Delegate the specialist work required to produce this trip plan.",
            brief: options.brief,
          }),
        },
      ],
    });
  } finally {
    sink.flush();
  }

  if (proposals.size === 0) {
    throw new Error("Supervisor completed without delegating to a specialist.");
  }
  // The prompt only asks the model to "consider" each domain, so it can return after picking
  // three and the plan quietly ships two sections short. Name the ones a plan is not a plan
  // without, and treat their absence as a failure: the caller falls back to dispatching every
  // specialist, which is the outcome the model was supposed to produce anyway.
  const required = (options.requiredAgents ?? DEFAULT_REQUIRED_AGENTS).filter((name) =>
    options.specialists.some((specialist) => specialist.name === name),
  );
  const missing = required.filter((name) => !proposals.has(name));
  if (missing.length) {
    throw new Error(`Supervisor skipped required specialist(s): ${missing.join(", ")}.`);
  }
  return options.specialists.flatMap((specialist) => {
    const proposal = proposals.get(specialist.name);
    return proposal ? [proposal] : [];
  });
}

/** Route validated revision requests through a named supervisor tool loop. */
export async function reviseWithSupervisor(
  options: SupervisorRevisionOptions,
): Promise<AgentProposal[]> {
  // The revision pass revises the round it is about to produce, so that round
  // names its episode: two conflict passes never share a block identity.
  const sink = createReasoningSink(options.context.round + 1, options.onProgress, options.context.round + 1);
  const model = options.model
    ? options.model
    : ((): BaseChatModel | undefined => {
        const routed = createRoutedChatModel("itinerary", { thinking: true });
        return routed ? sink.wrap(routed) : undefined;
      })();
  if (!model) throw new Error("Revision supervisor requires a configured routed chat model.");

  const revised = new Map<AgentProposal["agent"], AgentProposal>();
  const tools = createRevisionTools(options, (proposal) => revised.set(proposal.agent, proposal));
  if (tools.length === 0) return options.proposals;

  const supervisor = createAgent({
    name: "trip_revision_supervisor",
    model,
    tools,
    systemPrompt:
      "You are the trip revision supervisor. Call every provided revision specialist tool exactly once so each validated conflict request reaches its targeted owner. Do not rewrite requests, constraints or trip facts, and do not solve specialist work yourself. Stop after all revision tools return; LangGraph will re-run deterministic conflict validation.",
  });
  try {
    await supervisor.invoke({
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            task: "Delegate every pending revision request to its typed specialist tool.",
            tripId: options.brief.tripId,
            requests: options.requests,
          }),
        },
      ],
    });
  } finally {
    sink.flush();
  }

  const expected = new Set(tools.map((revisionTool) => revisionTool.name));
  if (revised.size !== expected.size) {
    throw new Error(
      `Revision supervisor delegated ${revised.size} of ${expected.size} pending request(s).`,
    );
  }
  return options.proposals.map((proposal) => revised.get(proposal.agent) ?? proposal);
}
