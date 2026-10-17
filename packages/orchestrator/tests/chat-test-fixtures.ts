import { FakeToolCallingModel } from "langchain";
import { AIMessage } from "@langchain/core/messages";
import { vi } from "vitest";
import type { ChatTurn, MemoryStore, Specialist, ToolGateway, TripBrief } from "@trip/shared";
import { runTripChat } from "../src/chat";

export const brief: TripBrief = {
  tripId: "chat-test",
  userId: "chat-user",
  destination: "Tokyo",
  dates: ["2027-06-15", "2027-06-22"],
  groupSize: 2,
  budgetTotal: 4000,
};

export const tools: ToolGateway = {
  maps: { route: vi.fn(async () => []), places: vi.fn(async () => []) },
  booking: { searchStays: vi.fn(async () => []), searchFlights: vi.fn(async () => []) },
};
export const itinerary: Specialist = {
  name: "itinerary",
  label: "Day plan",
  invoke: vi.fn(async ({ brief: updated }) => ({
    agent: "itinerary" as const,
    summary: `Plan for ${updated.destination}`,
    items: [{ kind: "activity", detail: "Walk", estCost: 100 }],
    assumptions: [],
    conflictsWith: [],
  })),
};

export function memoryStore(history: ChatTurn[] = []) {
  const turns: ChatTurn[] = [];
  const mem: MemoryStore = {
    getShortTerm: vi.fn(async () => [...history, ...turns]),
    appendShortTerm: vi.fn(async (_tripId, turn) => {
      turns.push(turn);
    }),
    getLongTerm: vi.fn(async () => []),
    setLongTerm: vi.fn(async () => {}),
    promote: vi.fn(async () => {}),
  };
  return { mem, turns };
}

export type ToolCall = { name: string; args: Record<string, unknown>; id: string };

export const scriptedModel = (...turns: ToolCall[][]) =>
  new FakeToolCallingModel({ toolCalls: [...turns, []] });

export class ReplyOverrideModel extends FakeToolCallingModel {
  constructor(
    readonly reply: string,
    toolCalls: ToolCall[][] = [[]],
  ) {
    super({ toolCalls: [...toolCalls, []] });
  }

  bindTools(_tools: Parameters<FakeToolCallingModel["bindTools"]>[0]) {
    return this;
  }

  async _generate(...args: Parameters<FakeToolCallingModel["_generate"]>) {
    const result = await super._generate(...args);
    const message = result.generations[0]?.message;
    if (!(message instanceof AIMessage) || (message.tool_calls?.length ?? 0) > 0) return result;
    return {
      ...result,
      generations: [
        {
          ...result.generations[0],
          message: new AIMessage(this.reply),
        },
      ],
    };
  }
}

export const run = (
  request: Parameters<typeof runTripChat>[0],
  model: FakeToolCallingModel,
  mem: MemoryStore,
  extra: Partial<Parameters<typeof runTripChat>[1]> = {},
) => runTripChat(request, { model, specialists: [itinerary], tools, mem, ...extra });
