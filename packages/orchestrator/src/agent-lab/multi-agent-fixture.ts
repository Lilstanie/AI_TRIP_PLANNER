import { allSpecialists } from "@trip/agents";
import type {
  AgentProgressEvent,
  MemoryStore,
  Specialist,
  TripPlan,
  UserPreference,
} from "@trip/shared";
import { withProgressTools } from "../progress-tools";
import { runOrchestrator } from "../workflow";
import type { AgentLabScenario } from "./scenarios";
import type { AgentLabStrategy } from "./strategy";

export interface MultiAgentFixtureOptions {
  /** Replaces the five registered specialists; tests use it to inject a failing one. */
  specialists?: Specialist[];
}

/** A read-only memory holding only the scenario's own preferences; nothing is stored or read from disk. */
function scenarioMemory(preferences: UserPreference[]): MemoryStore {
  return {
    getShortTerm: async () => [],
    appendShortTerm: async () => {},
    getLongTerm: async () => preferences,
    setLongTerm: async () => {},
    promote: async () => {},
  };
}

/**
 * The graph's deterministic dispatch hands each specialist the plain gateway. Wrapping each one here
 * attributes its tool calls to it in the trace without changing the production workflow.
 */
function withToolTrace(specialist: Specialist, publish: (event: AgentProgressEvent) => void) {
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

/**
 * The five registered specialists coordinated by the real LangGraph workflow for exactly one round.
 * The graph still decides the order (the planning board), detects conflicts and assembles the plan;
 * with one round allowed it never reaches the revision node, so unresolved conflicts are reported,
 * not repaired.
 *
 * Fixture mode relies on the environment having no model or provider keys, where the specialists take
 * their deterministic path and the tools return mock fixtures.
 */
export function createMultiAgentFixtureStrategy(
  options: MultiAgentFixtureOptions = {},
): AgentLabStrategy {
  const specialists = options.specialists ?? allSpecialists;
  return {
    id: "multi-agent-no-revision",
    actor: "multi-agent",
    completionSummary: (plan) => {
      const conflicts = plan.conflicts?.length ?? 0;
      return `${plan.sections.length} specialists finished one planning round; ${conflicts} conflict${conflicts === 1 ? "" : "s"} left unresolved because this strategy does not revise.`;
    },
    async run({ scenario, signal, emit }) {
      signal.throwIfAborted();
      await emit({
        type: "lab_strategy_started",
        actor: "multi-agent",
        objective:
          "Coordinate five specialists through the planning board for one round, then assemble and check one plan.",
        constraints: constraintsFor(scenario),
      });

      // The graph produces events faster than the stream paces them, so they queue here and are
      // published in order with the same pacing as every other strategy.
      const queue: AgentProgressEvent[] = [];
      let outcome: Outcome | undefined;
      let wake: (() => void) | undefined;
      const publish = (event: AgentProgressEvent) => {
        queue.push(event);
        wake?.();
      };

      const traced = specialists.map((specialist) => withToolTrace(specialist, publish));
      void runOrchestrator(scenario.brief, {
        specialists: traced,
        mem: scenarioMemory(scenario.preferences),
        maxRounds: 1,
        onProgress: publish,
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

function constraintsFor(scenario: AgentLabScenario): string[] {
  return [
    `Keep the whole trip within A$${scenario.brief.budgetTotal.toLocaleString("en-AU")}.`,
    "One planning round only; conflicts are reported, not repaired.",
    "Each specialist works only from its own tools and the shared planning board.",
  ];
}

export const multiAgentFixtureStrategy = createMultiAgentFixtureStrategy();
