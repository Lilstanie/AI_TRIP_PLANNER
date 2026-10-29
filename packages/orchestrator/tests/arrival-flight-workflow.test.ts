import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { transportAgent } from "@trip/agents";
import type { AgentContext, AgentProposal, TripBrief } from "@trip/shared";
import { detectConflicts } from "../src/conflicts";
import { runOrchestrator } from "../src/workflow";

const brief: TripBrief = {
  tripId: "arrival-test",
  userId: "traveller",
  origin: "Sydney",
  destination: "Tokyo",
  dates: ["2026-11-01", "2026-11-04"],
  groupSize: 1,
  budgetTotal: 9000,
};
const segment = (departsAt: string, arrivesAt: string) => ({
  from: { code: "SYD", name: "Sydney" },
  to: { code: "HND", name: "Tokyo" },
  departsAt,
  arrivesAt,
  durationMin: 600,
  airline: "MockAir",
  flightNumber: "MA1",
});
const context = (outbound?: {
  segments: ReturnType<typeof segment>[];
  layovers: never[];
  durationMin: number;
}): AgentContext => ({
  tripId: brief.tripId,
  round: 1,
  tools: {
    maps: { route: async () => [], places: async () => [] },
    booking: {
      searchFlights: async () => [
        { carrier: "MockAir", price: 1000, ...(outbound ? { outbound } : {}) },
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
});
const itinerary = (day: number, startTime: string, endTime: string): AgentProposal => ({
  agent: "itinerary",
  summary: "Sightseeing",
  items: [
    { kind: "activity", day, startTime, endTime, location: "Tokyo museum", detail: "Museum visit" },
  ],
  assumptions: [],
  conflictsWith: [],
});

describe("arrival flight workflow", () => {
  it("carries selected evidence into the arrival-day conflict check", async () => {
    const outbound = {
      segments: [segment("2026-11-01 22:00", "2026-11-02 07:00")],
      layovers: [] as never[],
      durationMin: 600,
    };
    const transport = await transportAgent.invoke({ brief, context: context(outbound) });
    const before = detectConflicts([transport, itinerary(2, "06:00", "08:00")], brief);
    const after = detectConflicts([transport, itinerary(2, "08:00", "09:00")], brief);
    const unknown = await transportAgent.invoke({ brief, context: context() });
    const unknownConflicts = detectConflicts([unknown, itinerary(1, "08:00", "09:00")], brief);
    mkdirSync("output/tp24", { recursive: true });
    writeFileSync(
      "output/tp24/arrival-flight-workflow.json",
      JSON.stringify({ transport, before, after, unknown, unknownConflicts }, null, 2),
    );
    expect(before.some((r) => r.targetAgent === "itinerary" && r.kind === "time")).toBe(true);
    expect(after.some((r) => r.targetAgent === "itinerary" && r.kind === "time")).toBe(false);
    const sameDay = await transportAgent.invoke({
      brief,
      context: context({
        segments: [segment("2026-11-01 08:00", "2026-11-01 17:00")],
        layovers: [],
        durationMin: 600,
      }),
    });
    expect(sameDay.items[0]).toMatchObject({ startTime: "08:00", endTime: "17:00" });
    const malformed = await transportAgent.invoke({
      brief,
      context: context({
        segments: [segment("2026-11-01 08:00", "2026-11-01 27:00")],
        layovers: [],
        durationMin: 600,
      }),
    });
    expect(malformed.items[0]).not.toHaveProperty("endTime");
    expect(detectConflicts([malformed, itinerary(1, "08:00", "09:00")], brief)).toEqual([]);
    expect(unknown.items[0]).not.toHaveProperty("startTime");
    expect(unknownConflicts.some((r) => r.targetAgent === "itinerary" && r.kind === "time")).toBe(
      false,
    );
  });
  it("revises a destination activity through the planning workflow", async () => {
    const outbound = {
      segments: [segment("2026-11-01 22:00", "2026-11-02 07:00")],
      layovers: [] as never[],
      durationMin: 600,
    };
    const ctx = context(outbound);
    const revisions: string[] = [];
    const planner = {
      name: "itinerary" as const,
      label: "Itinerary",
      supportsRevision: true,
      invoke: async (request: { revision?: { reason: string } }) => {
        if (request.revision) revisions.push(request.revision.reason);
        return request.revision ? itinerary(2, "08:00", "09:00") : itinerary(2, "06:00", "08:00");
      },
    };
    const plan = await runOrchestrator(brief, {
      specialists: [transportAgent, planner],
      tools: ctx.tools,
      mem: ctx.mem,
    });
    mkdirSync("output/tp24", { recursive: true });
    writeFileSync(
      "output/tp24/planning-workflow.json",
      JSON.stringify({ revisions, plan }, null, 2),
    );
    expect(revisions.some((reason) => reason.includes("before the flight arrives"))).toBe(true);
    expect(
      plan.sections.find((section) => section.id === "itinerary")?.proposal?.items[0]?.startTime,
    ).toBe("08:00");
  });
});
