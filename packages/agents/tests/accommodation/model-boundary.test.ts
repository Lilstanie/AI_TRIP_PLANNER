import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentContext, TripBrief } from "@trip/shared";

type Tool = () => Promise<{
  stays: {
    stayId: string;
    candidates: { candidateId: string; name: string; totalCost: number }[];
  }[];
}>;

/** What the fake specialist answers with; each test sets it before invoking. */
const behavior = vi.hoisted(() => ({
  respond: (_evidence: Awaited<ReturnType<Tool>>): unknown => ({ choices: [] }),
  skipTool: false,
  fail: false,
  /** The system prompt and the user message the specialist was last given. */
  seen: { prompt: "", message: "" },
}));

vi.mock("../../src/models", () => ({
  createRoutedChatModel: () => ({}),
  readStructuredResponse: (
    _name: string,
    schema: { parse(value: unknown): unknown },
    result: { structuredResponse: unknown },
  ) => schema.parse(result.structuredResponse),
}));
vi.mock("langchain", () => ({
  tool: (search: Tool) => search,
  createAgent: ({ tools, systemPrompt }: { tools: Tool[]; systemPrompt: string }) => ({
    invoke: async (input: { messages: { content: string }[] }) => {
      behavior.seen = { prompt: systemPrompt, message: input.messages[0]!.content };
      if (behavior.fail) throw new Error("provider failure");
      if (behavior.skipTool) return { structuredResponse: { choices: [] } };
      const evidence = await tools[0]!();
      return { structuredResponse: behavior.respond(evidence) };
    },
  }),
}));

import { TRAVELLER_PREFERENCES_RULE } from "../../src/prompts/traveller-preferences";
import { accommodationAgent } from "../../src/accommodation";

const brief: TripBrief = {
  tripId: "stay-boundary",
  userId: "test",
  destination: "Sydney",
  dates: ["2026-10-01", "2026-10-05"],
  groupSize: 2,
  budgetTotal: 4000,
};
// Deliberately ordered so the cheapest is not the one the heuristic prefers:
// chooseInitial wants rating >= 8 with free cancellation, i.e. Comfort.
const options = [
  { name: "Saver", area: "West", pricePerNight: 100, rating: 7, freeCancellation: false },
  { name: "Comfort", area: "Central", pricePerNight: 250, rating: 9, freeCancellation: true },
];
const context: AgentContext = {
  tripId: brief.tripId,
  round: 1,
  tools: {
    maps: { route: async () => [], places: async () => [] },
    booking: { searchFlights: async () => [], searchStays: async () => options },
  },
  mem: {
    getLongTerm: async () => [],
    getShortTerm: async () => [],
    appendShortTerm: async () => {},
    setLongTerm: async () => {},
    promote: async () => {},
  },
};

const pick = (name: string) => (evidence: Awaited<ReturnType<Tool>>) => ({
  choices: evidence.stays.map((stay) => ({
    stayId: stay.stayId,
    candidateId: stay.candidates.find((candidate) => candidate.name === name)!.candidateId,
    because: `${name} suits this trip.`,
  })),
});

beforeEach(() => {
  behavior.skipTool = false;
  behavior.fail = false;
  behavior.respond = pick("Comfort");
});

describe("the model's stay choice is load-bearing", () => {
  it("charges the candidate the model picked, not the one the heuristic prefers", async () => {
    behavior.respond = pick("Saver");
    const proposal = await accommodationAgent.invoke({ brief, context });

    // 1 room (2 guests), 4 nights. Saver at 100/night = 400; Comfort would be 1000.
    expect(proposal.items[0]!.estCost).toBe(400);
    expect(proposal.items[0]!.detail).toContain("Saver");
    expect(proposal.stays![0]!.selectedId).toBe(
      proposal.stays![0]!.candidates.find((candidate) => candidate.name === "Saver")!.id,
    );
  });

  it("still charges the heuristic's candidate when the model picks it", async () => {
    behavior.respond = pick("Comfort");
    const proposal = await accommodationAgent.invoke({ brief, context });
    expect(proposal.items[0]!.estCost).toBe(1000);
    expect(proposal.items[0]!.detail).toContain("Comfort");
  });

  it("carries the model's reason through to the traveller", async () => {
    behavior.respond = pick("Saver");
    const proposal = await accommodationAgent.invoke({ brief, context });
    expect(proposal.assumptions.join(" ")).toContain("Saver suits this trip.");
  });

  it("cannot be made to state a price of its own", async () => {
    // The selection schema has no money field, so an invented total is dropped by
    // parsing rather than reaching estCost. This is the point of the design.
    behavior.respond = (evidence) => ({
      ...pick("Saver")(evidence),
      estCost: 0,
      totalCost: 1,
      summary: "Free stay!",
    });
    const proposal = await accommodationAgent.invoke({ brief, context });
    expect(proposal.items[0]!.estCost).toBe(400);
    expect(JSON.stringify(proposal)).not.toContain("Free stay!");
  });

  it("falls back whole when the model names a candidate that does not exist", async () => {
    behavior.respond = (evidence) => ({
      choices: evidence.stays.map((stay) => ({
        stayId: stay.stayId,
        candidateId: "stay-1-99",
        because: "invented",
      })),
    });
    const proposal = await accommodationAgent.invoke({ brief, context });
    // The heuristic's choice, not a zero-cost item built from nothing.
    expect(proposal.items[0]!.estCost).toBe(1000);
    expect(proposal.assumptions.join(" ")).not.toContain("invented");
  });

  it("falls back to the heuristic when the specialist fails outright", async () => {
    behavior.fail = true;
    const proposal = await accommodationAgent.invoke({ brief, context });
    expect(proposal.items[0]!.estCost).toBe(1000);
    expect(proposal.source).toMatchObject({ kind: "fallback", label: "Local fallback" });
  });

  it("does not plan from an answer given without searching", async () => {
    behavior.skipTool = true;
    const proposal = await accommodationAgent.invoke({ brief, context });
    expect(proposal.items[0]!.estCost).toBe(1000);
    expect(proposal.source).toMatchObject({ kind: "fallback" });
  });
});

describe("the traveller's trip preferences", () => {
  it("reach the specialist with the brief, with the rule for weighing them", async () => {
    await accommodationAgent.invoke({
      brief: { ...brief, preferences: ["Quiet neighbourhood", "No red-eye flights"] },
      context,
    });
    expect(JSON.parse(behavior.seen.message).brief.preferences).toEqual([
      "Quiet neighbourhood",
      "No red-eye flights",
    ]);
    expect(behavior.seen.prompt).toContain(TRAVELLER_PREFERENCES_RULE);
  });
});
