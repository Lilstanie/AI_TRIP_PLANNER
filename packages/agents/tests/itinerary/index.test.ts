import { describe, expect, it, vi } from "vitest";
import {
  AgentProposal,
  type AgentContext,
  type RouteLeg,
  type RouteOption,
  type RouteQuery,
  type TripBrief,
} from "@trip/shared";
import { createItineraryAgent, type ItineraryGenerator } from "../../src/itinerary";

const brief: TripBrief = {
  tripId: "itinerary-test",
  userId: "traveller",
  destination: "Tokyo & Kyoto",
  dates: ["2026-10-01", "2026-10-03"],
  groupSize: 2,
  budgetTotal: 2000,
};

function context(durationMin = 30): AgentContext {
  return {
    tripId: brief.tripId,
    round: 1,
    tools: {
      maps: {
        places: vi.fn(async ({ category }) => [
          ...(category === "sight"
            ? [{ name: "Museum", category: "sight" }]
            : [
                { name: "Old Town", category: "neighborhood" },
                { name: "Garden", category: "neighborhood" },
              ]),
        ]),
        route: vi.fn(async () => [{ mode: "transit" as const, durationMin, price: 5 }]),
      },
      booking: { searchStays: vi.fn(async () => []), searchFlights: vi.fn(async () => []) },
    },
    mem: {
      getLongTerm: vi.fn(async () => [
        { key: "pace", value: "relaxed", source: "filter" as const },
      ]),
      getShortTerm: vi.fn(async () => []),
      appendShortTerm: vi.fn(async () => {}),
      setLongTerm: vi.fn(async () => {}),
      promote: vi.fn(async () => {}),
    },
  };
}

const feasibleDraft = {
  summary: "Three carefully paced days",
  activities: [
    {
      day: 1,
      startTime: "09:00",
      endTime: "11:00",
      location: "Museum",
      detail: "Visit the museum",
      estCost: 40,
    },
    {
      day: 1,
      startTime: "14:00",
      endTime: "16:00",
      location: "Old Town",
      detail: "Walk through the old town",
      estCost: 20,
    },
    {
      day: 2,
      startTime: "10:00",
      endTime: "12:00",
      location: "Garden",
      detail: "Visit the garden",
      estCost: 20,
    },
    {
      day: 3,
      startTime: "10:00",
      endTime: "12:00",
      location: "Old Town",
      detail: "Walk through the old town again",
      estCost: 20,
    },
  ],
  assumptions: ["Candidate places require confirmation."],
};

describe("itinerary planner", () => {
  it("builds a complete deterministic schedule without a model", async () => {
    const ctx = context();
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: ctx,
    });
    expect(AgentProposal.safeParse(result).success).toBe(true);
    expect(result.items.map((item) => item.day)).toEqual([1, 2, 3]);
    expect(result.items.every((item) => item.startTime === "13:00")).toBe(true);
    expect(result.summary).not.toContain("STUB");
    expect(result.assumptions.join(" ")).toContain("Opening hours and live availability");

    expect(ctx.tools.maps.places).toHaveBeenCalledTimes(4);
    expect(ctx.tools.maps.places).toHaveBeenCalledWith({ near: "Tokyo", category: "sight" });
    expect(ctx.tools.maps.places).toHaveBeenCalledWith({ near: "Kyoto", category: "sight" });
  });

  it("uses an injected structured generator and checks travel feasibility", async () => {
    const generator: ItineraryGenerator = { generate: vi.fn(async () => feasibleDraft) };
    const result = await createItineraryAgent({ generator }).invoke({
      brief,
      context: context(200),
    });
    expect(result.assumptions.join(" ")).not.toContain("LangChain");
    expect(result.conflictsWith[0]).toContain("geography conflict on day 1");
  });

  it("never passes a model's guessed admission price on as a cost", async () => {
    const generator: ItineraryGenerator = {
      generate: vi.fn(async () => ({
        ...feasibleDraft,
        activities: feasibleDraft.activities.map((activity) => ({
          ...activity,
          estCost: 1000,
        })),
      })),
    };
    const result = await createItineraryAgent({ generator }).invoke({
      brief,
      context: context(),
    });
    expect(result.items.every((item) => item.estCost === undefined)).toBe(true);
    expect(result.assumptions.join(" ")).toContain("Activity prices unknown");
  });

  it("uses the safe fallback if a revision is still geographically infeasible", async () => {
    const generator: ItineraryGenerator = { generate: vi.fn(async () => feasibleDraft) };
    const agent = createItineraryAgent({ generator });
    const result = await agent.invoke({
      brief,
      context: context(200),
      revision: {
        tripId: brief.tripId,
        targetAgent: "itinerary",
        reason: "geography conflict on day 1",
        constraints: ["make the route geographically feasible"],
      },
    });
    expect(result.conflictsWith).toEqual([]);
    expect(result.assumptions.join(" ")).toContain("Opening hours and live availability");
  });

  it("rejects revisions addressed to another agent", async () => {
    const agent = createItineraryAgent({ generator: false });
    await expect(
      agent.invoke({
        brief,
        context: context(),
        revision: {
          tripId: brief.tripId,
          targetAgent: "transport",
          reason: "time overlap",
          constraints: [],
        },
      }),
    ).rejects.toThrow("target this trip and agent");
  });

  it("rejects impossible trip dates before calling tools", async () => {
    const ctx = context();
    await expect(
      createItineraryAgent({ generator: false }).invoke({
        brief: { ...brief, dates: ["2026-02-30", "2026-03-02"] },
        context: ctx,
      }),
    ).rejects.toThrow("Enter a real date");
    expect(ctx.tools.maps.places).not.toHaveBeenCalled();
  });
});

describe("B itinerary reliability", () => {
  it("does not treat an empty route as a zero-minute journey", async () => {
    const ctx = context();
    vi.mocked(ctx.tools.maps.route).mockResolvedValue([]);
    const result = await createItineraryAgent({
      generator: { generate: async () => feasibleDraft },
    }).invoke({ brief, context: ctx });
    expect(result.conflictsWith.join(" ")).toContain("no route returned");
    expect(ctx.tools.maps.route).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2026-10-01" }),
    );
  });

  it("requires a fifteen-minute arrival buffer at the exact boundary", async () => {
    const generator = { generate: async () => feasibleDraft };
    const exact = await createItineraryAgent({ generator }).invoke({
      brief,
      context: context(165),
    });
    expect(exact.conflictsWith).toEqual([]);
    const late = await createItineraryAgent({ generator }).invoke({ brief, context: context(166) });
    expect(late.conflictsWith.join(" ")).toContain("15-minute buffer");
  });

  it("reports provider failure without dropping the complete proposal", async () => {
    const ctx = context();
    vi.mocked(ctx.tools.maps.route).mockRejectedValue(new Error("offline"));
    const result = await createItineraryAgent({
      generator: { generate: async () => feasibleDraft },
    }).invoke({ brief, context: ctx });
    expect(AgentProposal.safeParse(result).success).toBe(true);
    expect(result.conflictsWith.join(" ")).toContain("provider failed");
  });

  it("does not invent a central attraction when all evidence is unavailable", async () => {
    const ctx = context();
    vi.mocked(ctx.tools.maps.places).mockRejectedValue(new Error("offline"));
    const generate = vi.fn();
    const result = await createItineraryAgent({ generator: { generate } }).invoke({
      brief,
      context: ctx,
    });
    expect(result.items).toEqual([]);
    expect(result.conflictsWith.join(" ")).toContain("no grounded places");
    expect(generate).not.toHaveBeenCalled();
  });

  it("moves the deterministic fallback around A's blocked window", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(),
      revision: {
        tripId: brief.tripId,
        targetAgent: "itinerary",
        reason: "time overlap",
        constraints: [
          "on day 1 keep clear of 12:00-14:00, held by transport; reschedule without changing trip dates",
        ],
      },
    });
    expect(result.items[0]).toMatchObject({ startTime: "14:15", endTime: "17:15" });
    expect(result.conflictsWith).toEqual([]);
  });

  it("retains a conflict when no daytime slot remains", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(),
      revision: {
        tripId: brief.tripId,
        targetAgent: "itinerary",
        reason: "time overlap",
        constraints: ["on day 1 keep clear of 09:00-19:00, held by transport"],
      },
    });
    expect(result.conflictsWith.join(" ")).toContain("no daytime slot");
  });

  it("does not swallow cancellation during a model call", async () => {
    const controller = new AbortController();
    const ctx = { ...context(), signal: controller.signal };
    const generator = {
      generate: async () => {
        controller.abort();
        throw new Error("cancelled");
      },
    };
    await expect(
      createItineraryAgent({ generator }).invoke({ brief, context: ctx }),
    ).rejects.toThrow();
  });
});

describe("city connections", () => {
  function richContext(durationMin = 30): AgentContext {
    const base = context(durationMin);
    base.tools.maps.places = vi.fn(async ({ category }) =>
      category === "sight"
        ? [
            { name: "Sydney Opera House", category: "sight" },
            { name: "Sydney Tower Eye", category: "sight" },
          ]
        : [
            { name: "Bondi Beach", category: "neighborhood" },
            { name: "The Rocks", category: "neighborhood" },
          ],
    );
    base.tools.maps.routeOptions = vi.fn(async () => [
      {
        mode: "bus" as const,
        durationMin,
        price: 0,
        priceBasis: "unavailable" as const,
        note: "via bus 333",
      },
      { mode: "drive" as const, durationMin: 20, price: 0, priceBasis: "partial" as const },
    ]);
    return base;
  }

  it("plans two stops a day when there are places for them, and says how to get between", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: richContext(),
    });
    expect(result.items.map((item) => item.day)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(result.items.map((item) => item.startTime)).toEqual([
      "09:30",
      "14:00",
      "09:30",
      "14:00",
      "09:30",
      "14:00",
    ]);

    expect(result.items[0]!.arriveBy).toBeUndefined();
    expect(result.items[1]!.arriveBy).toMatchObject({
      mode: "bus",

      line: "333",
      durationMin: 30,
      from: "Sydney Opera House",
    });
  });

  it("plans the fallback without inventing admission prices", async () => {
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: richContext(),
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.estCost === undefined)).toBe(true);
  });

  it("leaves the connection out when the route provider cannot answer", async () => {
    const ctx = richContext();
    ctx.tools.maps.route = vi.fn(async () => {
      throw new Error("route provider down");
    });
    const result = await createItineraryAgent({ generator: false }).invoke({ brief, context: ctx });
    expect(result.items.every((item) => item.arriveBy === undefined)).toBe(true);
    expect(result.conflictsWith.join(" ")).toContain("connection unverified");
  });
});

describe("multi-city days", () => {
  it("keeps activities aligned with the city of each overnight stay", async () => {
    const trip = {
      ...brief,
      destination: "Sydney & Wollongong",
      dates: ["2026-12-16", "2026-12-20"] as [string, string],
    };
    const ctx = context();
    ctx.tools.maps.places = vi.fn(async ({ near, category }) =>
      category === "sight"
        ? [{ name: `${near} Museum`, category: "sight" }]
        : [{ name: `${near} Foreshore`, category: "neighborhood" }],
    );
    const transport: AgentProposal = {
      agent: "transport",
      summary: "Transfer to Wollongong on day 3",
      items: [
        {
          kind: "transport",
          day: 3,
          startTime: "10:30",
          endTime: "11:30",
          location: "Sydney → Wollongong",
          detail: "Train to Wollongong on 2026-12-18",
        },
      ],
      assumptions: [],
      conflictsWith: [],
    };
    const accommodation: AgentProposal = {
      agent: "accommodation",
      summary: "Two nights in Sydney, then two nights in Wollongong",
      items: [],
      assumptions: [],
      conflictsWith: [],
      stays: [
        {
          id: "stay-1",
          city: "Sydney",
          checkIn: "2026-12-16",
          checkOut: "2026-12-18",
          day: 1,
          nights: 2,
          rooms: 1,
          selectedId: "stay-1-0",
          candidates: [
            {
              id: "stay-1-0",
              name: "Sydney Standard",
              area: "Sydney",
              pricePerNight: 230,
              rating: 8,
              freeCancellation: true,
            },
          ],
        },
        {
          id: "stay-3",
          city: "Wollongong",
          checkIn: "2026-12-18",
          checkOut: "2026-12-20",
          day: 3,
          nights: 2,
          rooms: 1,
          selectedId: "stay-3-0",
          candidates: [
            {
              id: "stay-3-0",
              name: "Wollongong Standard",
              area: "Wollongong",
              pricePerNight: 180,
              rating: 8,
              freeCancellation: true,
            },
          ],
        },
      ],
    };
    const generator: ItineraryGenerator = {
      generate: vi.fn(async () => ({
        summary: "Every day based in Wollongong",
        activities: Array.from({ length: 5 }, (_, index) => ({
          day: index + 1,
          startTime: "10:00",
          endTime: "12:00",
          location: "Wollongong Foreshore",
          detail: "Walk along the foreshore",
        })),
        assumptions: [],
      })),
    };

    const result = await createItineraryAgent({ generator }).invoke({
      brief: trip,
      context: ctx,
      board: { proposals: [transport, accommodation] },
    });

    expect(result.items.map(({ day, location }) => ({ day, location }))).toEqual([
      { day: 1, location: "Sydney Museum" },
      { day: 2, location: "Sydney Foreshore" },
      { day: 3, location: "Wollongong Museum" },
      { day: 4, location: "Wollongong Foreshore" },
      { day: 5, location: "Wollongong Museum" },
    ]);
  });

  it("keeps a day's stops in the city that day is spent in", async () => {
    const ctx = context();
    ctx.tools.maps.places = vi.fn(async ({ near, category }) =>
      category === "sight"
        ? [
            { name: `${near} Museum`, category: "sight" },
            { name: `${near} Gallery`, category: "sight" },
          ]
        : [{ name: `${near} Old Town`, category: "neighborhood" }],
    );
    const result = await createItineraryAgent({ generator: false }).invoke({
      brief: { ...brief, destination: "Tokyo & Kyoto", dates: ["2026-10-01", "2026-10-05"] },
      context: ctx,
    });
    for (const item of result.items) {
      const city = item.day! <= 2 ? "Tokyo" : "Kyoto";
      expect(item.location, `day ${item.day}`).toContain(city);
    }
  });

  it("allows departure and arrival activities around a transfer within its window", async () => {
    const trip = {
      ...brief,
      destination: "Sydney & Wollongong",
      dates: ["2026-12-16", "2026-12-20"] as [string, string],
    };
    const ctx = context();
    ctx.tools.maps.places = vi.fn(async ({ near, category }) =>
      category === "sight"
        ? [{ name: `${near} Museum`, category: "sight" }]
        : [{ name: `${near} Foreshore`, category: "neighborhood" }],
    );
    const transport: AgentProposal = {
      agent: "transport",
      summary: "Transfer to Wollongong on day 3",
      items: [
        {
          kind: "transport",
          day: 3,
          startTime: "10:30",
          endTime: "11:30",
          location: "Sydney → Wollongong",
          detail: "Train to Wollongong on 2026-12-18",
        },
      ],
      assumptions: [],
      conflictsWith: [],
    };
    const accommodation: AgentProposal = {
      agent: "accommodation",
      summary: "Two nights in Sydney, then two nights in Wollongong",
      items: [],
      assumptions: [],
      conflictsWith: [],
      stays: [
        {
          id: "stay-1",
          city: "Sydney",
          checkIn: "2026-12-16",
          checkOut: "2026-12-18",
          day: 1,
          nights: 2,
          rooms: 1,
          selectedId: "stay-1-0",
          candidates: [
            {
              id: "stay-1-0",
              name: "Sydney Standard",
              area: "Sydney",
              pricePerNight: 230,
              rating: 8,
              freeCancellation: true,
            },
          ],
        },
        {
          id: "stay-3",
          city: "Wollongong",
          checkIn: "2026-12-18",
          checkOut: "2026-12-20",
          day: 3,
          nights: 2,
          rooms: 1,
          selectedId: "stay-3-0",
          candidates: [
            {
              id: "stay-3-0",
              name: "Wollongong Standard",
              area: "Wollongong",
              pricePerNight: 180,
              rating: 8,
              freeCancellation: true,
            },
          ],
        },
      ],
    };
    const generator: ItineraryGenerator = {
      generate: vi.fn(async () => ({
        summary: "A transfer day with stops on both sides",
        activities: [
          {
            day: 1,
            startTime: "09:00",
            endTime: "11:00",
            location: "Sydney Museum",
            detail: "Museum",
          },
          {
            day: 2,
            startTime: "09:00",
            endTime: "11:00",
            location: "Sydney Foreshore",
            detail: "Foreshore",
          },
          {
            day: 3,
            startTime: "09:00",
            endTime: "10:00",
            location: "Sydney Museum",
            detail: "Before the transfer",
          },
          {
            day: 3,
            startTime: "12:00",
            endTime: "13:00",
            location: "Wollongong Foreshore",
            detail: "After the transfer",
          },
          {
            day: 4,
            startTime: "09:00",
            endTime: "11:00",
            location: "Wollongong Museum",
            detail: "Museum",
          },
          {
            day: 5,
            startTime: "09:00",
            endTime: "11:00",
            location: "Wollongong Foreshore",
            detail: "Foreshore",
          },
        ],
        assumptions: [],
      })),
    };

    const result = await createItineraryAgent({ generator }).invoke({
      brief: trip,
      context: ctx,
      board: { proposals: [transport, accommodation] },
    });

    expect(result.items.filter(({ day }) => day === 3).map(({ location }) => location)).toEqual([
      "Sydney Museum",
      "Wollongong Foreshore",
    ]);
  });

  it("omits a transfer-day fallback activity when no existing slot fits the transfer window", async () => {
    const trip = {
      ...brief,
      destination: "Sydney & Wollongong",
      dates: ["2026-12-16", "2026-12-20"] as [string, string],
    };
    const ctx = context();
    ctx.tools.maps.places = vi.fn(async ({ near, category }) =>
      category === "sight"
        ? [{ name: `${near} Museum`, category: "sight" }]
        : [{ name: `${near} Foreshore`, category: "neighborhood" }],
    );
    const transport: AgentProposal = {
      agent: "transport",
      summary: "Transfer to Wollongong on day 3",
      items: [
        {
          kind: "transport",
          day: 3,
          startTime: "08:00",
          endTime: "18:00",
          location: "Sydney → Wollongong",
          detail: "Train to Wollongong on 2026-12-18",
        },
      ],
      assumptions: [],
      conflictsWith: [],
    };
    const accommodation: AgentProposal = {
      agent: "accommodation",
      summary: "Two nights in Sydney, then two nights in Wollongong",
      items: [],
      assumptions: [],
      conflictsWith: [],
      stays: [
        {
          id: "stay-1",
          city: "Sydney",
          checkIn: "2026-12-16",
          checkOut: "2026-12-18",
          day: 1,
          nights: 2,
          rooms: 1,
          selectedId: "stay-1-0",
          candidates: [
            {
              id: "stay-1-0",
              name: "Sydney Standard",
              area: "Sydney",
              pricePerNight: 230,
              rating: 8,
              freeCancellation: true,
            },
          ],
        },
        {
          id: "stay-3",
          city: "Wollongong",
          checkIn: "2026-12-18",
          checkOut: "2026-12-20",
          day: 3,
          nights: 2,
          rooms: 1,
          selectedId: "stay-3-0",
          candidates: [
            {
              id: "stay-3-0",
              name: "Wollongong Standard",
              area: "Wollongong",
              pricePerNight: 180,
              rating: 8,
              freeCancellation: true,
            },
          ],
        },
      ],
    };
    const invalidModelActivities = [1, 2, 3, 4, 5].map((day) => ({
      day,
      startTime: "13:00",
      endTime: "16:00",
      location: "Wollongong Foreshore",
      detail: "Walk along the foreshore",
    }));
    const generator: ItineraryGenerator = {
      generate: vi.fn(async () => ({
        summary: "All days in Wollongong",
        activities: invalidModelActivities,
        assumptions: [],
      })),
    };
    const request = { brief: trip, context: ctx, board: { proposals: [transport, accommodation] } };

    const generatedFallback = await createItineraryAgent({ generator }).invoke(request);
    const offlineFallback = await createItineraryAgent({ generator: false }).invoke(request);

    expect(generator.generate).toHaveBeenCalledTimes(2);
    for (const result of [generatedFallback, offlineFallback]) {
      expect(result.items.filter(({ day }) => day === 3)).toEqual([]);
      expect(result.conflictsWith.join(" ")).toContain("day 3");
      expect(result.assumptions.join(" ")).toContain("incomplete");
    }
  });
});

describe("routing between two stops the provider can find", () => {
  const opera = { latitude: -33.8568, longitude: 151.2153 };
  const tower = { latitude: -33.8704, longitude: 151.2088 };

  function located(towerLocation?: { latitude: number; longitude: number }) {
    const ctx = context();
    ctx.tools.maps.places = vi.fn(async ({ category }) =>
      category === "sight"
        ? [
            { name: "Sydney Opera House", category: "sight", location: opera },
            {
              name: "Sydney Tower Eye",
              category: "sight",
              ...(towerLocation ? { location: towerLocation } : {}),
            },
          ]
        : [
            { name: "Bondi Beach", category: "neighborhood" },
            { name: "The Rocks", category: "neighborhood" },
          ],
    );
    const route = vi.fn<(q: RouteQuery) => Promise<RouteLeg[]>>(async () => [
      { mode: "transit", durationMin: 30, price: 5 },
    ]);
    const routeOptions = vi.fn<(q: RouteQuery) => Promise<RouteOption[]>>(async () => [
      { mode: "bus", durationMin: 30, price: 0, priceBasis: "unavailable" },
    ]);
    ctx.tools.maps.route = route;
    ctx.tools.maps.routeOptions = routeOptions;
    return { ctx, route, routeOptions };
  }

  it("asks for the route between the places the provider returned, not two names", async () => {
    const { ctx, route, routeOptions } = located(tower);

    await createItineraryAgent({ generator: false }).invoke({ brief, context: ctx });

    for (const spy of [route, routeOptions]) {
      expect(spy.mock.calls[0]![0]).toMatchObject({
        from: "Sydney Opera House",
        to: "Sydney Tower Eye",
        fromLocation: opera,
        toLocation: tower,
      });
    }
  });

  it("leaves an end unresolved rather than inventing a position for it", async () => {
    const { ctx, route } = located();

    await createItineraryAgent({ generator: false }).invoke({ brief, context: ctx });

    const query = route.mock.calls[0]![0];
    expect(query).toMatchObject({ fromLocation: opera });
    expect("toLocation" in query).toBe(false);
  });
});

describe("fallback timing after a failed itinerary revision", () => {
  it("returns the original fallback times when a requested shift crosses a scheduled transfer", async () => {
    const trip = {
      ...brief,
      destination: "Sydney & Wollongong",
      dates: ["2026-12-16", "2026-12-20"] as [string, string],
    };
    const ctx = context();
    ctx.tools.maps.places = vi.fn(async ({ near, category }) =>
      category === "sight"
        ? [{ name: `${near} Museum`, category: "sight" }]
        : [{ name: `${near} Park`, category: "neighborhood" }],
    );
    ctx.tools.maps.route = vi.fn(async () => {
      throw new Error("Route evidence unavailable");
    });
    const transport: AgentProposal = {
      agent: "transport",
      summary: "Transfer to Wollongong on day 3",
      items: [
        {
          kind: "transport",
          day: 3,
          startTime: "13:30",
          endTime: "14:30",
          location: "Sydney → Wollongong",
          detail: "Train to Wollongong",
        },
      ],
      assumptions: [],
      conflictsWith: [],
    };
    const activities = [
      { day: 1, startTime: "09:00", endTime: "10:00", location: "Sydney Museum", detail: "Visit" },
      { day: 2, startTime: "09:00", endTime: "10:00", location: "Sydney Museum", detail: "Visit" },
      { day: 3, startTime: "08:00", endTime: "09:00", location: "Sydney Museum", detail: "Visit" },
      { day: 3, startTime: "09:15", endTime: "10:00", location: "Sydney Park", detail: "Visit" },
      { day: 3, startTime: "15:00", endTime: "16:00", location: "Wollongong Park", detail: "Visit" },
      { day: 4, startTime: "09:00", endTime: "10:00", location: "Wollongong Museum", detail: "Visit" },
      { day: 5, startTime: "09:00", endTime: "10:00", location: "Wollongong Museum", detail: "Visit" },
    ];
    const generator: ItineraryGenerator = {
      generate: vi.fn(async () => ({ summary: "Plan", activities, assumptions: [] })),
    };
    const result = await createItineraryAgent({ generator }).invoke({
      brief: trip,
      context: ctx,
      revision: { constraints: ["on day 3 keep clear of 10:00-12:30"] },
      board: { proposals: [transport] },
    });
    const dayThree = result.items.filter(({ day }) => day === 3);

    expect(dayThree).toHaveLength(1);
    expect(dayThree[0]).toMatchObject({
      location: "Sydney Museum",
      startTime: "09:30",
      endTime: "12:00",
    });
    expect(result.conflictsWith.join(" ")).toContain("Fallback activity times were kept unchanged");
  });
});
