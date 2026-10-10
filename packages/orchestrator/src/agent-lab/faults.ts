import { FakeToolCallingModel } from "langchain";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AgentName, Specialist, ToolGateway } from "@trip/shared";
import type { AgentLabFaultProfile } from "./fault-profiles";

type Request = Parameters<Specialist["invoke"]>[0];

const timeout = () => new DOMException("The operation was aborted due to timeout", "TimeoutError");

function wrap(
  specialists: Specialist[],
  name: AgentName,
  around: (specialist: Specialist) => Specialist["invoke"],
): Specialist[] {
  return specialists.map((specialist) =>
    specialist.name === name ? { ...specialist, invoke: around(specialist) } : specialist,
  );
}

function withGateway(specialist: Specialist, change: (tools: ToolGateway) => ToolGateway) {
  return (request: Request) =>
    specialist.invoke({
      ...request,
      context: { ...request.context, tools: change(request.context.tools) },
    });
}

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
      return wrap(specialists, "dining", (specialist) => async (request) => ({
        ...(await specialist.invoke(request)),
        items: null as never,
      }));
    case "stalled-revision":
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

export function agentLabSupervisorFaultModel(): BaseChatModel {
  return new FakeToolCallingModel({ toolCalls: [[]] });
}
