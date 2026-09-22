import { describe, expect, it, vi } from "vitest";
import {
  AgentProposal,
  type AgentContext,
  type TripBrief,
  type UserPreference,
} from "@trip/shared";
import { transportAgent } from "../../src/transport";

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
    { carrier: "MockAir Economy", price: 1200, note: "group total" },
    { carrier: "MockAir Flexible", price: 1600, note: "group total" },
  ]);
  const route = vi.fn(async () => [
    { mode: "train" as const, durationMin: 140, price: 90, note: "fixture" },
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
    expect(result.source).toMatchObject({ kind: "mock", label: "Mock booking and route data" });
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

  it("prefers the origin stated in the brief over the standing preference", async () => {
    // The preference is a default for people who always leave from the same
    // city; what the traveller said about *this* trip has to win.
    const { ctx, searchFlights } = context([
      { key: "transport.origin", value: "Melbourne", source: "chat_confirmed" },
    ]);
    const result = await transportAgent.invoke({
      brief: { ...brief, origin: "Perth" },
      context: ctx,
    });
    expect(searchFlights).toHaveBeenCalledWith(expect.objectContaining({ from: "Perth" }));
    expect(result.items[0]).toMatchObject({ location: "Perth → Tokyo" });
  });

  it("falls back to the standing preference when the brief states no origin", async () => {
    const { ctx, searchFlights } = context([
      { key: "transport.origin", value: "Melbourne", source: "chat_confirmed" },
    ]);
    await transportAgent.invoke({ brief: { ...brief, origin: undefined }, context: ctx });
    expect(searchFlights).toHaveBeenCalledWith(expect.objectContaining({ from: "Melbourne" }));
  });

  it("offers the ground-transport choice on each hop when the adapter has one", async () => {
    const { ctx } = context();
    ctx.tools.maps.routeOptions = vi.fn(async () => [
      {
        mode: "drive" as const,
        durationMin: 29,
        price: 13.29,
        priceBasis: "partial" as const,
        note: "tolls only",
      },
      {
        mode: "bus" as const,
        durationMin: 74,
        price: 0,
        priceBasis: "unavailable" as const,
        note: "via bus 52",
      },
    ]);
    const result = await transportAgent.invoke({ brief, context: ctx });
    const hop = result.items.find((item) => item.detail?.includes("Ways to make this hop"))!;
    expect(hop).toBeTruthy();
    // A partial cost reads as a floor, and an unpriced fare says so rather than
    // appearing as free next to a priced drive.
    expect(hop.detail).toContain("drive 29 min, from A$13.29");
    expect(hop.detail).toContain("bus 74 min, fare not published");
  });

  it("keeps a hop's timing when the comparison lookup fails", async () => {
    // The options only describe a choice; losing them must not cost the hop its
    // place in the schedule.
    const { ctx } = context();
    ctx.tools.maps.routeOptions = vi.fn(async () => {
      throw new Error("options provider down");
    });
    const result = await transportAgent.invoke({ brief, context: ctx });
    expect(result.items.some((item) => item.kind === "transport")).toBe(true);
    expect(result.items.some((item) => item.detail?.includes("Ways to make this hop"))).toBe(false);
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
    expect(route).toHaveBeenCalledWith(
      expect.objectContaining({ day: 3, date: "2026-10-03", localTime: "09:00" }),
    );
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
    expect(result.source).toMatchObject({ kind: "unavailable", label: "Flight provider" });
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
      { mode: "train", durationMin: 140, price: 0, note: "fare unavailable" },
    ]);
    const result = await transportAgent.invoke({ brief, context: ctx });
    expect(result.items[1]).not.toHaveProperty("estCost");
    expect(result.conflictsWith.join(" ")).toContain("not a free trip");
    expect(AgentProposal.safeParse(result).success).toBe(true);
  });

  it.each([NaN, -1, 0, Infinity])(
    "does not emit a timed route for invalid/unrepresentable duration %s",
    async (durationMin) => {
      const { ctx, route } = context();
      route.mockResolvedValue([{ mode: "train", durationMin, price: 90, note: "fixture" }]);
      const result = await transportAgent.invoke({ brief, context: ctx });
      expect(result.items).toHaveLength(1);
      expect(result.conflictsWith.length).toBeGreaterThan(0);
    },
  );

  it("flies a city hop the ground journey cannot fit into one planning day", async () => {
    // 1600 minutes of train is not a scheduling failure to report — it is a
    // journey that has to be flown. The scheduler would otherwise reject the
    // hop and leave the traveller a conflict where a flight belongs.
    const { ctx, route, searchFlights } = context();
    route.mockResolvedValue([{ mode: "train", durationMin: 1600, price: 90, note: "fixture" }]);
    const result = await transportAgent.invoke({ brief, context: ctx });
    expect(searchFlights).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Tokyo", to: "Kyoto" }),
    );
    // One fare for the arrival, one for the promoted hop, and no timed route.
    expect(result.items.filter((item) => item.kind === "transport")).toHaveLength(2);
    expect(result.items.some((item) => item.location === "Tokyo → Kyoto")).toBe(true);
    expect(result.conflictsWith.join(" ")).not.toContain("cannot fit inside one planning day");
  });

  it("does not mistake OSRM driving time for public transport", async () => {
    const { ctx, route } = context();
    route.mockResolvedValue([
      {
        mode: "train",
        durationMin: 20,
        price: 0,
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
    ).rejects.toThrow("Enter a real date");
    expect(route).not.toHaveBeenCalled();
    expect(searchFlights).not.toHaveBeenCalled();
  });
});

describe("transport choice", () => {
  it("keeps the fares the chosen flight beat, so the transcript can show them", async () => {
    const { ctx } = context();
    const result = await transportAgent.invoke({ brief, context: ctx });
    const flight = result.flights?.[0];
    expect(flight).toBeTruthy();
    expect(flight!.from).toBe("Sydney");
    expect(flight!.to).toBe("Tokyo");
    // Both fares the mock offers survive the choice; one is marked selected.
    expect(flight!.candidates.map((candidate) => candidate.carrier)).toEqual([
      "MockAir Economy",
      "MockAir Flexible",
    ]);
    expect(flight!.candidates.some((candidate) => candidate.id === flight!.selectedId)).toBe(true);
  });

  it("offers no choice when no fare came back", async () => {
    const { ctx, searchFlights } = context();
    searchFlights.mockResolvedValue([]);
    const result = await transportAgent.invoke({ brief, context: ctx });
    expect(result.flights).toBeUndefined();
  });
});
