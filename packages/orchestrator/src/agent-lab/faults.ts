import { FakeToolCallingModel } from "langchain";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AgentName, Specialist, ToolGateway } from "@trip/shared";
import type { AgentLabFaultProfile } from "./fault-profiles";

type Request = Parameters<Specialist["invoke"]>[0];

const timeout = () => new DOMException("The operation was aborted due to timeout", "TimeoutError");

/** Replaces one specialist with a wrapped copy; the others are returned as they are. */
function wrap(
  specialists: Specialist[],
  name: AgentName,
  around: (specialist: Specialist) => Specialist["invoke"],
): Specialist[] {
  return specialists.map((specialist) =>
    specialist.name === name ? { ...specialist, invoke: around(specialist) } : specialist,
  );
}

/** Gives one specialist a gateway whose provider call is replaced. */
function withGateway(specialist: Specialist, change: (tools: ToolGateway) => ToolGateway) {
  return (request: Request) =>
    specialist.invoke({
      ...request,
      context: { ...request.context, tools: change(request.context.tools) },
    });
}

/**
 * The registered faults, as wrappers around the same specialists the workflow already runs. They are
 * applied outside the trace wrapper, so the failures flow through the same progress tools and the same
 * validation as any other run; nothing here edits the production workflow's behaviour.
 */
export function applyAgentLabFault(
  profile: AgentLabFaultProfile,
  specialists: Specialist[],
): Specialist[] {
  switch (profile.id) {
    case "provider-timeout":
      return wrap(specialists, "transport", (specialist) =>
        withGateway(specialist, (tools) => ({
          ...tools,
          booking: {
            ...tools.booking,
            searchFlights: async () => {
              throw timeout();
            },
          },
        })),
      );
    case "provider-empty-result":
      return wrap(specialists, "accommodation", (specialist) =>
        withGateway(specialist, (tools) => ({
          ...tools,
          booking: { ...tools.booking, searchStays: async () => [] },
        })),
      );
    case "invalid-agent-output":
      // The proposal comes back with its items missing, which the shared schema rejects.
      return wrap(specialists, "dining", (specialist) => async (request) => ({
        ...(await specialist.invoke(request)),
        items: null as never,
      }));
    case "stalled-revision":
      // A revision that hands back what the specialist proposed before: no change, so no improvement.
      return wrap(
        specialists,
        "transport",
        (specialist) => async (request) =>
          request.revision && request.previous ? request.previous : specialist.invoke(request),
      );
    case "supervisor-failure":
      return specialists;
  }
}

/**
 * A scripted supervisor that delegates to nobody. The workflow's own check then finds that the day
 * plan, which a trip cannot do without, was skipped, and falls back to dispatching deterministically.
 */
export function agentLabSupervisorFaultModel(): BaseChatModel {
  return new FakeToolCallingModel({ toolCalls: [[]] });
}
