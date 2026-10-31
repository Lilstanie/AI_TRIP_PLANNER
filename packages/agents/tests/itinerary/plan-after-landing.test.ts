import { describe, expect, it, vi } from "vitest";
import type { AgentContext, AgentProposal, Place, TripBrief } from "@trip/shared";
import { createItineraryAgent, type ItineraryGenerator } from "../../src/itinerary";

const brief: TripBrief = {
  tripId: "plan-after-landing",
  userId: "traveller",
  destination: "Tokyo",
  dates: ["2026-12-10", "2026-12-12"],
  groupSize: 2,
  budgetTotal: 8000,
};

const found: Place[] = ["Senso-ji", "Meiji Jingu", "Ueno Park", "Tokyo Tower"].map((name) => ({
  name,
  category: "sight",
}));

function context(): AgentContext {
  return {
    tripId: brief.tripId,
    round: 1,
    tools: {
      maps: {
        places: vi.fn(async ({ category }) => (category === "sight" ? found : [])),
        route: vi.fn(async () => [{ mode: "transit" as const, durationMin: 20, price: 3 }]),
      },
      booking: { searchStays: vi.fn(async () => []), searchFlights: vi.fn(async () => []) },
    },
    mem: {
      getLongTerm: vi.fn(async () => []),
      getShortTerm: vi.fn(async () => []),
      appendShortTerm: vi.fn(async () => {}),
      setLongTerm: vi.fn(async () => {}),
      promote: vi.fn(async () => {}),
    },
  };
}

function transport(arrivesAt: string, selected = "overnight"): AgentProposal {
  const leg = (departsAt: string, landsAt: string) => ({
    segments: [
      {
        from: { code: "SYD", name: "Sydney" },
        to: { code: "HND", name: "Tokyo Haneda" },
        departsAt,
        arrivesAt: landsAt,
        durationMin: 600,
        airline: "Test Air",
        flightNumber: "TA1",
      },
    ],
    layovers: [],
    durationMin: 600,
  });
  return {
    agent: "transport",
    summary: "Flights",
    items: [],
    assumptions: [],
    conflictsWith: [],
    flights: [
      {
        id: "flight-0",
        from: "Sydney",
        to: "Tokyo",
        depart: "2026-12-10",
        day: 1,
        passengers: 2,
        selectedId: selected,
        candidates: [
          {
            id: "daytime",
            carrier: "Test Air",
            price: 900,
            outbound: leg("2026-12-10 06:00", "2026-12-10 14:00"),
          },
          {
            id: "overnight",
            carrier: "Test Air",
            price: 800,
            outbound: leg("2026-12-10 22:50", arrivesAt),
          },
        ],
      },
    ],
  };
}

const startOf = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour! * 60 + minute!;
};

describe("the day plan starts after the outbound flight lands", () => {
  it("plans nothing on the day in the air and leaves time to clear the airport after an 08:50 landing", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(),
      board: { proposals: [transport("2026-12-11 08:50")] },
    });

    expect(result.items.some((item) => item.day === 1)).toBe(false);
    const dayTwo = result.items.filter((item) => item.day === 2);
    expect(dayTwo.length).toBeGreaterThan(0);
    for (const item of dayTwo)
      expect(startOf(item.startTime!)).toBeGreaterThanOrEqual(startOf("10:20"));
    expect(result.items.some((item) => item.day === 3)).toBe(true);
    expect(result.assumptions.join("\n")).toContain("lands on day 2 at 08:50");
    expect(result.assumptions.join("\n")).not.toMatch(/Day 1 is incomplete/);
    expect(result.conflictsWith).toEqual([]);
  });

  it("reads the selected flight's last segment, the same one the conflict check reads", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(),
      board: { proposals: [transport("2026-12-11 08:50", "daytime")] },
    });

    expect(result.items.some((item) => item.day === 1)).toBe(true);
    for (const item of result.items.filter((entry) => entry.day === 1))
      expect(startOf(item.startTime!)).toBeGreaterThanOrEqual(startOf("15:30"));
  });

  it("forces no evening stop after a late landing", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(),
      board: { proposals: [transport("2026-12-10 22:30", "overnight")] },
    });

    expect(result.items.some((item) => item.day === 1)).toBe(false);
    expect(result.assumptions.join("\n")).not.toMatch(/Day 1 is incomplete/);
  });

  it("keeps day 1 for a trip without a flight", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(),
    });

    expect(result.items.some((item) => item.day === 1)).toBe(true);
  });

  it("tells the model when the flight lands, rejects a stop before it and accepts a draft that skips the flight day", async () => {
    const before = {
      summary: "Three days",
      activities: [
        { day: 1, startTime: "15:00", endTime: "17:00", location: "Senso-ji", detail: "Temple" },
        { day: 2, startTime: "11:00", endTime: "13:00", location: "Ueno Park", detail: "Park" },
        { day: 3, startTime: "10:00", endTime: "12:00", location: "Tokyo Tower", detail: "Tower" },
      ],
      assumptions: [],
    };
    const after = { ...before, activities: before.activities.slice(1) };
    const generate = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    const generator: ItineraryGenerator = { generate };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await createItineraryAgent({ generator }).invoke({
      brief,
      context: context(),
      board: { proposals: [transport("2026-12-11 08:50")] },
    });

    expect(generate.mock.calls[0]![0].arrival).toEqual({
      day: 2,
      time: "08:50",
      earliestStart: "10:20",
    });
    expect(String(generate.mock.calls[1]![0].feedback)).toContain("before the flight lands");
    expect(result.items.map((item) => [item.day, item.location])).toEqual([
      [2, "Ueno Park"],
      [3, "Tokyo Tower"],
    ]);
    expect(result.source?.kind).not.toBe("fallback");
    warn.mockRestore();
  });
});
