import { formatMoney } from "@trip/shared";
import { allSpecialists } from "@trip/agents";
import type {
  AgentLabEventPayload,
  MemoryStore,
  Specialist,
  TripPlan,
  UserPreference,
} from "@trip/shared";
import { withProgressTools } from "../progress-tools";
import type { WorkflowDecision } from "../decisions";
import { runOrchestrator } from "../workflow";
import { agentLabSupervisorFaultModel, applyAgentLabFault } from "./faults";
import type { AgentLabScenario } from "./scenarios";
import type { AgentLabStrategy } from "./strategy";

export interface MultiAgentFixtureOptions {
  specialists?: Specialist[];

  revise?: boolean;
}

const REVISION_ROUNDS = 3;

const score = (value: number) => value.toLocaleString("en-AU", { maximumFractionDigits: 2 });
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const stopSummary = {
  converged: () => "No conflicts remain.",
  round_limit: (n: number) =>
    `Stopped at the round limit with ${plural(n, "conflict")} unresolved.`,
  infeasible_budget: () =>
    "Stopped: even the cheapest options found exceed the budget, so no revision can help.",
  no_improvement: () =>
    "Stopped: the revision did not improve the plan, so the earlier proposals stand.",
} as const;

function decisionEvent(decision: WorkflowDecision): AgentLabEventPayload {
  switch (decision.type) {
    case "conflicts_detected":
      return {
        type: "lab_conflict_detected",
        round: decision.round,
        score: decision.score,
        infeasible: decision.infeasible,
        conflicts: decision.conflicts,
        summary: decision.conflicts.length
          ? `${plural(decision.conflicts.length, "conflict")} found${decision.infeasible ? " (infeasible)" : ""}; plan score ${score(decision.score)} (0 means within budget with no other conflict).`
          : "No conflicts found; plan score 0.",
      };
    case "revision_started":
      return {
        type: "lab_revision_started",
        round: decision.round,
        agent: decision.agent,
        objective: decision.objective,
        previousOutcome: `${decision.previousSummary} · ${formatMoney(decision.previousCost, "AUD")}`,
      };
    case "revision_scored":
      return {
        type: "lab_revision_scored",
        round: decision.round,
        agents: decision.agents,
        scoreBefore: decision.scoreBefore,
        scoreAfter: decision.scoreAfter,
        kept: decision.kept,
        summary: `Plan score ${score(decision.scoreBefore)} to ${score(decision.scoreAfter)}; ${
          decision.kept ? "revision kept." : "revision discarded, the previous proposals stand."
        }`,
      };
    case "loop_stopped":
      return {
        type: "lab_loop_stopped",
        round: decision.round,
        reason: decision.reason,
        unresolved: decision.unresolved,
        summary: stopSummary[decision.reason](decision.unresolved),
      };
    case "agent_output_rejected":
      return {
        type: "lab_agent_output_rejected",
        agent: decision.agent,
        round: decision.round,
        fields: decision.fields,
        summary: `The ${decision.agent} specialist's output failed the shared proposal schema (${decision.fields.join(", ")}) and was rejected.`,
      };
    case "delegation_fallback":
      return {
        type: "lab_supervisor_fallback",
        phase: decision.phase,
        round: decision.round,
        summary:
          decision.phase === "dispatch"
            ? "The supervisor could not delegate, so the coordinator dispatched the specialists deterministically."
            : "The supervisor could not route the revision, so the coordinator revised the sections deterministically.",
      };
  }
}

function scenarioMemory(preferences: UserPreference[]): MemoryStore {
  return {
    getShortTerm: async () => [],
    appendShortTerm: async () => {},
    getLongTerm: async () => preferences,
    setLongTerm: async () => {},
    promote: async () => {},
  };
}

function withToolTrace(specialist: Specialist, publish: (event: AgentLabEventPayload) => void) {
  return {
    ...specialist,
    invoke: (request: Parameters<Specialist["invoke"]>[0]) =>
      specialist.invoke({
        ...request,
        context: {
          ...request.context,
          tools: withProgressTools(
            request.context.tools,
            specialist.name,
            request.context.round,
            publish,
          ),
        },
      }),
  } satisfies Specialist;
}

type Outcome = { plan: TripPlan } | { error: unknown };

export function createMultiAgentFixtureStrategy(
  options: MultiAgentFixtureOptions = {},
): AgentLabStrategy {
  const specialists = options.specialists ?? allSpecialists;
  const revise = options.revise ?? false;
  return {
    id: revise ? "multi-agent-targeted-revision" : "multi-agent-no-revision",
    actor: "multi-agent",
    live: true,
    completionSummary: (plan) => {
      const conflicts = plan.conflicts?.length ?? 0;
      return revise
        ? `${plural(plan.sections.length, "specialist")} planned over ${plural(plan.round, "round")}; ${plural(conflicts, "conflict")} left unresolved.`
        : `${plural(plan.sections.length, "specialist")} finished one planning round; ${plural(conflicts, "conflict")} left unresolved because this strategy does not revise.`;
    },
    async run({ scenario, signal, emit, fault }) {
      signal.throwIfAborted();
      await emit({
        type: "lab_strategy_started",
        actor: "multi-agent",
        objective: revise
          ? "Coordinate five specialists through the planning board, then repair detected conflicts by revising only the specialists they name."
          : "Coordinate five specialists through the planning board for one round, then assemble and check one plan.",
        constraints: constraintsFor(scenario, revise),
      });

      const queue: AgentLabEventPayload[] = [];
      let outcome: Outcome | undefined;
      let wake: (() => void) | undefined;
      const publish = (event: AgentLabEventPayload) => {
        if (event.type === "agent_reasoning") return;
        queue.push(event);
        wake?.();
      };

      const traced = specialists.map((specialist) => withToolTrace(specialist, publish));

      const faulted = fault ? applyAgentLabFault(fault, traced) : traced;
      void runOrchestrator(scenario.brief, {
        specialists: faulted,
        ...(fault?.id === "supervisor-failure"
          ? { supervisorModel: agentLabSupervisorFaultModel() }
          : {}),
        mem: scenarioMemory(scenario.preferences),
        maxRounds: revise ? REVISION_ROUNDS : 1,
        onProgress: publish,
        onDecision: (decision) => publish(decisionEvent(decision)),
      }).then(
        (plan) => {
          outcome = { plan };
          wake?.();
        },
        (error: unknown) => {
          outcome = { error };
          wake?.();
        },
      );

      while (true) {
        while (queue.length) await emit(queue.shift()!);
        if (outcome) break;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        wake = undefined;
      }
      if ("error" in outcome) throw outcome.error;
      return outcome.plan;
    },
  };
}

function constraintsFor(scenario: AgentLabScenario, revise: boolean): string[] {
  return [
    `Keep the whole trip within A$${scenario.brief.budgetTotal.toLocaleString("en-AU")}.`,
    revise
      ? `At most ${REVISION_ROUNDS} rounds; a revision that does not improve the plan is discarded and the loop stops.`
      : "One planning round only; conflicts are reported, not repaired.",
    "Each specialist works only from its own tools and the shared planning board.",
  ];
}

export const multiAgentFixtureStrategy = createMultiAgentFixtureStrategy();
export const multiAgentRevisionFixtureStrategy = createMultiAgentFixtureStrategy({ revise: true });
