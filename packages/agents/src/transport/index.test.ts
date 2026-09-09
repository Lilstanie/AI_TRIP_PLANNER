import { describe, expect, it, vi } from "vitest";
import {
  AgentProposal,
  type AgentContext,
  type TripBrief,
  type UserPreference,
} from "@trip/shared";
import { transportAgent } from "./index";
import { splitStay } from "../accommodation/planning";

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
  it("travels on the next hotel's check-in date when nights do not divide evenly", async () => {
    const unevenBrief: TripBrief = { ...brief, dates: ["2026-10-01", "2026-10-06"] };
    const { ctx, route } = context();
    const result = await transportAgent.run(unevenBrief, ctx);
    const nextStay = splitStay(unevenBrief)[1]!;
    expect(nextStay.day).toBe(4);
    expect(result.items[1]?.day).toBe(nextStay.day);
    expect(route).toHaveBeenCalledWith(
      expect.objectContaining({ date: nextStay.checkIn, from: "Tokyo", to: "Kyoto" }),
    );
  });
  it("combines a whole-group flight with timed inter-city routes", async () => {
    const { ctx, route, searchFlights } = context();
    const result = await transportAgent.run(brief, ctx);
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
    const result = await transportAgent.revise!(brief, ctx, {
      tripId: brief.tripId,
      targetAgent: "transport",
      reason: "plan is over budget",
      constraints: ["cut transport cost by ~30%"],
    });
    expect(result.items[0]).toMatchObject({ estCost: 1200, location: "Melbourne → Tokyo" });
    expect(result.assumptions.join(" ")).toContain("lowest returned flight fare");
  });

  it("moves routed legs earlier for a schedule revision", async () => {
    const result = await transportAgent.revise!(brief, context().ctx, {
      tripId: brief.tripId,
      targetAgent: "transport",
      reason: "time overlap on day 3",
      constraints: ["reschedule"],
    });
    expect(result.items[1]).toMatchObject({ startTime: "06:00", endTime: "08:20" });
  });

  it("avoids a same-city flight and plans an airport transfer", async () => {
    const { ctx, searchFlights, route } = context();
    const result = await transportAgent.run({ ...brief, destination: "Sydney" }, ctx);
    expect(searchFlights).not.toHaveBeenCalled();
    expect(route).toHaveBeenCalledWith(expect.objectContaining({ from: "Sydney airport" }));
    expect(result.items).toHaveLength(1);
  });

  it("rejects revisions addressed to another trip", async () => {
    await expect(
      transportAgent.revise!(brief, context().ctx, {
        tripId: "other-trip",
        targetAgent: "transport",
        reason: "budget",
        constraints: [],
      }),
    ).rejects.toThrow("target this trip and agent");
  });
});
