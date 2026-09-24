import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentContext, TripBrief } from "@trip/shared";

type Evidence = {
  planningDays: number;
  flights: { flightId: string; legIndex: number; carrier: string; totalCost: number }[];
  hops: { hopId: string; from: string; to: string }[];
};
type Tool = () => Promise<Evidence>;

const behavior = vi.hoisted(() => ({
  respond: (_evidence: Evidence): unknown => ({ schedule: [] }),
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
      if (behavior.skipTool) return { structuredResponse: { schedule: [] } };
      const evidence = await tools[0]!();
      return { structuredResponse: behavior.respond(evidence) };
    },
  }),
}));

import { TRAVELLER_PREFERENCES_RULE } from "../../src/prompts/traveller-preferences";
import { transportAgent } from "../../src/transport";

const brief: TripBrief = {
  tripId: "boundary",
  userId: "test",
  destination: "Tokyo & Kyoto",
  dates: ["2026-10-01", "2026-10-05"],
  groupSize: 2,
  budgetTotal: 4000,
};
const context: AgentContext = {
  tripId: brief.tripId,
  round: 1,
  tools: {
    maps: {
      route: async () => [{ mode: "train", durationMin: 140, price: 120, note: "Shinkansen" }],
      places: async () => [],
    },
    booking: {
      searchFlights: async () => [
        { carrier: "Evidence Air", price: 500 },
        { carrier: "Flex Air", price: 900 },
      ],
      searchStays: async () => [],
    },
  },
  mem: {
    getLongTerm: async () => [],
    getShortTerm: async () => [],
    appendShortTerm: async () => {},
    setLongTerm: async () => {},
    promote: async () => {},
  },
};

/** A well-formed selection: one fare per flown hop, every hop on a given day/time. */
const choose = (carrier: string, day: number, startTime: string) => (evidence: Evidence) => ({
  // One id per flown hop: the named carrier where it is offered, else the
  // first fare that hop has.
  flightIds: [...new Set(evidence.flights.map((flight) => flight.legIndex))].map((legIndex) => {
    const forHop = evidence.flights.filter((flight) => flight.legIndex === legIndex);
    return (forHop.find((flight) => flight.carrier === carrier) ?? forHop[0]!).flightId;
  }),
  schedule: evidence.hops.map((hop) => ({ hopId: hop.hopId, day, startTime })),
  guidance: [`Leaving at ${startTime} keeps the afternoon free.`],
});

beforeEach(() => {
  behavior.skipTool = false;
  behavior.fail = false;
  behavior.respond = choose("Flex Air", 2, "09:00");
});

describe("the model's transport choices are load-bearing", () => {
  it("takes the flight the model chose, not the one the heuristic prefers", async () => {
    // The heuristic picks the carrier whose name matches /flex/; the model picks the cheaper one.
    behavior.respond = choose("Evidence Air", 2, "09:00");
    const result = await transportAgent.invoke({ brief, context });
    const flight = result.items.find((item) => item.detail.includes("Evidence Air"));
    expect(flight?.estCost).toBe(500);
    expect(result.items.some((item) => item.detail.includes("Flex Air"))).toBe(false);
  });

  it("schedules hops on the day and time the model chose", async () => {
    behavior.respond = choose("Flex Air", 3, "06:30");
    const result = await transportAgent.invoke({ brief, context });
    const hop = result.items.find((item) => item.kind === "transport" && item.startTime);
    expect(hop?.day).toBe(3);
    expect(hop?.startTime).toBe("06:30");
    expect(hop?.endTime).toBe("08:50");
    // The date in the detail has to follow the chosen day, not the day the hop was
    // searched on; the trip starts 2026-10-01, so day 3 is 2026-10-03.
    expect(hop?.detail).toContain("2026-10-03");
  });

  it("carries the model's guidance through to the traveller", async () => {
    behavior.respond = choose("Flex Air", 2, "07:15");
    const result = await transportAgent.invoke({ brief, context });
    expect(result.assumptions.join(" ")).toContain("keeps the afternoon free");
  });

  it("cannot be made to state a fare of its own", async () => {
    // The selection schema has no money field, so an invented fare is dropped by parsing
    // rather than reaching estCost. That is the point of choosing by id.
    behavior.respond = (evidence) => ({
      ...choose("Evidence Air", 2, "09:00")(evidence),
      estCost: 0,
      items: [{ kind: "transport", detail: "Invented free flight", estCost: 0 }],
      summary: "rewritten",
    });
    const result = await transportAgent.invoke({ brief, context });
    expect(result.items.find((item) => item.detail.includes("Evidence Air"))?.estCost).toBe(500);
    expect(JSON.stringify(result)).not.toContain("Invented free flight");
    expect(result.summary).not.toBe("rewritten");
  });

  it.each([
    [
      "an unknown flight id",
      (e: Evidence) => ({ ...choose("Flex Air", 2, "09:00")(e), flightIds: ["flight-99-0"] }),
    ],
    ["a day outside the trip", (e: Evidence) => choose("Flex Air", 99, "09:00")(e)],
    ["an unreadable time", (e: Evidence) => choose("Flex Air", 2, "half past nine")(e)],
    [
      "an unscheduled hop",
      (e: Evidence) => ({ ...choose("Flex Air", 2, "09:00")(e), schedule: [] }),
    ],
  ])("falls back whole on %s", async (_label, respond) => {
    behavior.respond = respond;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await transportAgent.invoke({ brief, context });
    // The heuristic's flight and its 09:00 default, not a partly-applied selection.
    expect(result.items.find((item) => item.detail.includes("Flex Air"))?.estCost).toBe(900);
    expect(result.assumptions.join(" ")).not.toContain("keeps the afternoon free");
    expect(result.source).toMatchObject({ kind: "fallback", label: "Local fallback" });
    warning.mockRestore();
  });

  it.each(["skipTool", "fail"] as const)(
    "uses the deterministic calculator when model behavior is %s",
    async (key) => {
      behavior[key] = true;
      const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = await transportAgent.invoke({ brief, context });
      expect(result.items.find((item) => item.detail.includes("Flex Air"))?.estCost).toBe(900);
      expect(result.source).toMatchObject({ kind: "fallback", label: "Local fallback" });
      warning.mockRestore();
    },
  );
});

describe("the traveller's trip preferences", () => {
  it("reach the specialist with the brief, with the rule for weighing them", async () => {
    await transportAgent.invoke({
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
