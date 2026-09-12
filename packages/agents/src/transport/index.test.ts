import { describe, expect, it, vi } from "vitest";
import {
  AgentProposal,
  type AgentContext,
  type TripBrief,
  type UserPreference,
} from "@trip/shared";
import { transportAgent } from "./index";

const brief: TripBrief = {
  tripId: "transport-test",
  userId: "traveller",
  destination: "Tokyo & Kyoto",
  dates: ["2026-10-01", "2026-10-05"],
  groupSize: 2,
  budgetTotal: 4000,
};

function context(preferences: UserPreference[] = []) {
  const searchFlights = vi.fn(async () => [
    { carrier: "MockAir Economy", priceUsd: 1200, note: "group total" },
    { carrier: "MockAir Flexible", priceUsd: 1600, note: "group total" },
  ]);
  const route = vi.fn(async () => [
    { mode: "train" as const, durationMin: 140, priceUsd: 90, note: "fixture" },
  ]);
  const ctx: AgentContext = {
    tripId: brief.tripId,
    round: 1,
    tools: {
      maps: { route, places: vi.fn(async () => []) },
      booking: { searchFlights, searchStays: vi.fn(async () => []) },
    },
    mem: {
      getLongTerm: vi.fn(async () => preferences),
      getShortTerm: vi.fn(async () => []),
      appendShortTerm: vi.fn(async () => {}),
      setLongTerm: vi.fn(async () => {}),
      promote: vi.fn(async () => {}),
    },
  };
  return { ctx, route, searchFlights };
}

describe("transport planner", () => {
  it("combines a whole-group flight with timed inter-city routes", async () => {
    const { ctx, route, searchFlights } = context();
    const result = await transportAgent.invoke({ brief, context: ctx });
    expect(AgentProposal.safeParse(result).success).toBe(true);
    expect(result.summary).not.toContain("STUB");
    expect(result.items.map((item) => item.estCost)).toEqual([1600, 90]);
    expect(result.items[1]).toMatchObject({ day: 3, startTime: "09:00", endTime: "11:20" });
    expect(searchFlights).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Sydney", to: "Tokyo", passengers: 2 }),
    );
    expect(route).toHaveBeenCalledWith(expect.objectContaining({ from: "Tokyo", to: "Kyoto" }));
  });

  it("uses confirmed origin and selects the cheapest flight during budget revision", async () => {
    const { ctx } = context([
      { key: "transport.origin", value: "Melbourne", source: "chat_confirmed" },
    ]);
    const result = await transportAgent.invoke({
      brief,
      context: ctx,
      revision: {
        tripId: brief.tripId,
        targetAgent: "transport",
        reason: "plan is over budget",
        constraints: ["cut transport cost by ~30%"],
      },
    });
    expect(result.items[0]).toMatchObject({ estCost: 1200, location: "Melbourne → Tokyo" });
    expect(result.assumptions.join(" ")).toContain("lowest returned flight fare");
  });

  it("moves routed legs earlier for a schedule revision", async () => {
    const result = await transportAgent.invoke({
      brief,
      context: context().ctx,
      revision: {
        tripId: brief.tripId,
        targetAgent: "transport",
        reason: "time overlap on day 3",
        constraints: ["reschedule"],
      },
    });
    expect(result.items[1]).toMatchObject({ startTime: "06:00", endTime: "08:20" });
  });

  it("avoids a same-city flight and plans an airport transfer", async () => {
    const { ctx, searchFlights, route } = context();
    const result = await transportAgent.invoke({
      brief: { ...brief, destination: "Sydney" },
      context: ctx,
    });
    expect(searchFlights).not.toHaveBeenCalled();
    expect(route).toHaveBeenCalledWith(expect.objectContaining({ from: "Sydney airport" }));
    expect(result.items).toHaveLength(1);
  });

  it("rejects revisions addressed to another trip", async () => {
    await expect(
      transportAgent.invoke({
        brief,
        context: context().ctx,
        revision: {
          tripId: "other-trip",
          targetAgent: "transport",
          reason: "budget",
          constraints: [],
        },
      }),
    ).rejects.toThrow("target this trip and agent");
  });
});

describe("B transport reliability", () => {
  it("queries the date of the assigned travel day, not the first day", async () => {
    const { ctx, route } = context();
    await transportAgent.invoke({ brief, context: ctx });
    expect(route).toHaveBeenCalledWith(expect.objectContaining({ day: 3, date: "2026-10-03" }));
  });

  it("reports missing routes and flights while preserving available evidence", async () => {
    const { ctx, route, searchFlights } = context();
    route.mockResolvedValue([]);
    searchFlights.mockResolvedValue([]);
    const result = await transportAgent.invoke({ brief, context: ctx });
    expect(result.items).toEqual([]);
    expect(result.conflictsWith.join(" ")).toContain("no route returned");
    expect(result.conflictsWith.join(" ")).toContain("no valid fare");
    expect(result.summary).toContain("incomplete");
  });

  it("degrades provider exceptions into unresolved conflicts", async () => {
    const { ctx, route } = context();
    route.mockRejectedValue(new Error("offline"));
    const result = await transportAgent.invoke({ brief, context: ctx });
    expect(result.items[0]!.estCost).toBe(1600);
    expect(result.conflictsWith.join(" ")).toContain("provider unavailable");
  });

  it("omits unknown fares rather than claiming a free route", async () => {
    const { ctx, route } = context();
    route.mockResolvedValue([
      { mode: "train", durationMin: 140, priceUsd: 0, note: "fare unavailable" },
    ]);
    const result = await transportAgent.invoke({ brief, context: ctx });
    expect(result.items[1]).not.toHaveProperty("estCost");
    expect(result.conflictsWith.join(" ")).toContain("not a free trip");
    expect(AgentProposal.safeParse(result).success).toBe(true);
  });

  it.each([NaN, -1, 0, Infinity, 1600])(
    "does not emit a timed route for invalid/unrepresentable duration %s",
    async (durationMin) => {
      const { ctx, route } = context();
      route.mockResolvedValue([{ mode: "train", durationMin, priceUsd: 90, note: "fixture" }]);
      const result = await transportAgent.invoke({ brief, context: ctx });
      expect(result.items).toHaveLength(1);
      expect(result.conflictsWith.length).toBeGreaterThan(0);
    },
  );

  it("does not mistake OSRM driving time for public transport", async () => {
    const { ctx, route } = context();
    route.mockResolvedValue([
      {
        mode: "train",
        durationMin: 20,
        priceUsd: 0,
        note: "OSRM driving estimate; fare unavailable",
      },
    ]);
    const result = await transportAgent.invoke({ brief, context: ctx });
    expect(result.conflictsWith.join(" ")).toContain("driving estimate");
  });

  it("validates calendar dates before any provider call", async () => {
    const { ctx, route, searchFlights } = context();
    await expect(
      transportAgent.invoke({
        brief: { ...brief, dates: ["2026-02-30", "2026-03-05"] },
        context: ctx,
      }),
    ).rejects.toThrow("valid YYYY-MM-DD");
    expect(route).not.toHaveBeenCalled();
    expect(searchFlights).not.toHaveBeenCalled();
  });
});
