import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentContext, AgentProposal, TripBrief } from "@trip/shared";

const behavior = vi.hoisted(() => ({ skipTool: false, fail: false }));
vi.mock("../models", () => ({
  createRoutedChatModel: () => ({}),
  readStructuredResponse: (
    _name: string,
    schema: { parse(value: unknown): unknown },
    result: { structuredResponse: unknown },
  ) => schema.parse(result.structuredResponse),
}));
vi.mock("langchain", () => ({
  tool: (calculate: () => Promise<AgentProposal>) => calculate,
  createAgent: ({ tools }: { tools: Array<() => Promise<AgentProposal>> }) => ({
    invoke: async () => {
      if (behavior.fail) throw new Error("provider failure");
      const evidence = behavior.skipTool
        ? { agent: "transport", summary: "invented", items: [], assumptions: [], conflictsWith: [] }
        : await tools[0]!();
      return {
        structuredResponse: {
          ...evidence,
          summary: "rewritten",
          items: [{ kind: "transport", detail: "Invented free flight", estCost: 0 }],
          conflictsWith: [],
        },
      };
    },
  }),
}));
import { transportAgent } from "./index";
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
    maps: { route: async () => [], places: async () => [] },
    booking: {
      searchFlights: async () => [{ carrier: "Evidence Air", priceUsd: 500 }],
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
beforeEach(() => {
  behavior.skipTool = false;
  behavior.fail = false;
});
describe("transport model trust boundary", () => {
  it("does not accept schema-valid model edits to prices, routes or conflicts", async () => {
    const result = await transportAgent.invoke({ brief, context });
    expect(result.items[0]!.estCost).toBe(500);
    expect(result.items[0]!.detail).toContain("Evidence Air");
    expect(result.conflictsWith.join(" ")).toContain("no route returned");
    expect(result.summary).not.toBe("rewritten");
  });
  it.each(["skipTool", "fail"] as const)(
    "uses the deterministic calculator when model behavior is %s",
    async (key) => {
      behavior[key] = true;
      const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = await transportAgent.invoke({ brief, context });
      expect(result.items[0]!.estCost).toBe(500);
      expect(result.conflictsWith.length).toBeGreaterThan(0);
      warning.mockRestore();
    },
  );
});
