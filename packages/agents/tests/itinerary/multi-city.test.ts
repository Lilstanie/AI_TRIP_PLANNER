import { describe, expect, it, vi } from "vitest";
import type { AgentContext, AgentProposal, TripBrief } from "@trip/shared";
import { createItineraryAgent, type ItineraryGenerator } from "../../src/itinerary";

const brief: TripBrief = {
  tripId: "itinerary-multicity-test",
  userId: "traveller",
  destination: "Tokyo & Kyoto",
  dates: ["2026-10-01", "2026-10-03"],
  groupSize: 2,
  budgetTotal: 2000,
};

function context(): AgentContext {
  return {
    tripId: brief.tripId,
    round: 1,
    tools: {
      maps: {
        places: vi.fn(async ({ category }) => [
          ...(category === "sight"
            ? [{ name: "Museum", category: "sight" }]
            : [{ name: "Old Town", category: "neighborhood" }]),
        ]),
        route: vi.fn(async () => [{ mode: "transit" as const, durationMin: 30, price: 5 }]),
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

describe("multi-city transfer-day activities", () => {
  it("does not place activities on a transfer day when the flight has no usable times", async () => {
    const trip = {
      ...brief,
      destination: "Sydney & Wollongong",
      dates: ["2026-12-16", "2026-12-18"] as [string, string],
    };
    const ctx = context();
    ctx.tools.maps.places = vi.fn(async ({ near, category }) =>
      category === "sight"
        ? [{ name: `${near} Museum`, category: "sight" }]
        : [{ name: `${near} Foreshore`, category: "neighborhood" }],
    );
    const transport: AgentProposal = {
      agent: "transport",
      summary: "Fly from Sydney to Wollongong on day 1",
      items: [
        {
          kind: "transport",
          day: 1,
          location: "Sydney → Wollongong",
          detail: "Own flight to Wollongong on 2026-12-16",
        },
      ],
      assumptions: [],
      conflictsWith: [],
    };
    const generator: ItineraryGenerator = {
      generate: vi.fn(async () => ({
        summary: "Visit before the untimed flight",
        activities: [
          {
            day: 1,
            startTime: "13:00",
            endTime: "14:00",
            location: "Sydney Museum",
            detail: "Visit after the flight without usable transfer times",
          },
          {
            day: 2,
            startTime: "09:00",
            endTime: "10:00",
            location: "Wollongong Museum",
            detail: "Visit after the move",
          },
          {
            day: 3,
            startTime: "09:00",
            endTime: "10:00",
            location: "Wollongong Museum",
            detail: "Visit on the final day",
          },
        ],
        assumptions: [],
      })),
    };

    const result = await createItineraryAgent({ generator }).invoke({
      brief: trip,
      context: ctx,
      board: { proposals: [transport] },
    });

    expect(result.items.filter(({ day }) => day === 1)).toEqual([]);
  });

  it("does not keep destination activities after a one-way transfer when the night is in the origin city", async () => {
    const trip = {
      ...brief,
      destination: "Sydney & Wollongong",
      dates: ["2026-12-16", "2026-12-18"] as [string, string],
    };
    const ctx = context();
    ctx.tools.maps.places = vi.fn(async ({ near, category }) =>
      category === "sight"
        ? [
            { name: `${near} Museum`, category: "sight" },
            { name: `${near} Gallery`, category: "sight" },
          ]
        : [
            { name: `${near} Foreshore`, category: "neighborhood" },
            { name: `${near} Lookout`, category: "neighborhood" },
          ],
    );
    const transport: AgentProposal = {
      agent: "transport",
      summary: "Transfer to Wollongong on day 1",
      items: [
        {
          kind: "transport",
          day: 1,
          startTime: "09:00",
          endTime: "11:20",
          location: "Sydney → Wollongong",
          detail: "Train to Wollongong on 2026-12-16",
        },
      ],
      assumptions: [],
      conflictsWith: [],
    };
    const accommodation: AgentProposal = {
      agent: "accommodation",
      summary: "Two nights in Sydney",
      items: [],
      assumptions: [],
      conflictsWith: [],
      stays: [
        {
          id: "stay-sydney",
          city: "Sydney",
          checkIn: "2026-12-16",
          checkOut: "2026-12-20",
          day: 1,
          nights: 2,
          rooms: 1,
          selectedId: "stay-sydney-0",
          candidates: [
            {
              id: "stay-sydney-0",
              name: "Sydney Standard",
              area: "Sydney",
              pricePerNight: 230,
              rating: 8,
              freeCancellation: true,
            },
          ],
        },
      ],
    };
    const generator: ItineraryGenerator = {
      generate: vi.fn(async () => ({
        summary: "Day 1 moves to Wollongong",
        activities: [
          {
            day: 1,
            startTime: "08:00",
            endTime: "08:45",
            location: "Sydney Museum",
            detail: "Visit before departure",
          },
          {
            day: 1,
            startTime: "12:00",
            endTime: "13:00",
            location: "Wollongong Foreshore",
            detail: "Visit after arrival",
          },
          {
            day: 2,
            startTime: "09:00",
            endTime: "10:00",
            location: "Sydney Foreshore",
            detail: "Visit near the overnight stay",
          },
          {
            day: 3,
            startTime: "09:00",
            endTime: "10:00",
            location: "Wollongong Museum",
            detail: "Visit on the checkout day",
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

    expect(
      result.items
        .filter(({ day }) => day === 1)
        .some(({ location }) => location?.startsWith("Wollongong")),
    ).toBe(false);

    const roundTripTransport: AgentProposal = {
      ...transport,
      summary: "Transfer to Wollongong and return to Sydney on day 1",
      items: [
        {
          kind: "transport",
          day: 1,
          startTime: "15:00",
          endTime: "17:20",
          location: "Wollongong → Sydney",
          detail: "Train back to Sydney on 2026-12-16",
        },
        ...transport.items,
      ],
    };
    const roundTripGenerator: ItineraryGenerator = {
      generate: vi.fn(async () => ({
        summary: "Day 1 visits Wollongong and returns to Sydney",
        activities: [
          {
            day: 1,
            startTime: "08:00",
            endTime: "08:45",
            location: "Sydney Museum",
            detail: "Visit before departure",
          },
          {
            day: 1,
            startTime: "12:00",
            endTime: "13:00",
            location: "Wollongong Foreshore",
            detail: "Visit before the return journey",
          },
          {
            day: 1,
            startTime: "17:30",
            endTime: "18:30",
            location: "Sydney Gallery",
            detail: "Visit after returning to the overnight city",
          },
          {
            day: 2,
            startTime: "09:00",
            endTime: "10:00",
            location: "Sydney Foreshore",
            detail: "Visit near the overnight stay",
          },
          {
            day: 3,
            startTime: "09:00",
            endTime: "10:00",
            location: "Sydney Museum",
            detail: "Visit on the checkout day",
          },
        ],
        assumptions: [],
      })),
    };
    const returned = await createItineraryAgent({ generator: roundTripGenerator }).invoke({
      brief: trip,
      context: ctx,
      board: { proposals: [roundTripTransport, accommodation] },
    });
    expect(returned.items.filter(({ day }) => day === 1).map(({ location }) => location)).toEqual([
      "Sydney Museum",
      "Wollongong Foreshore",
      "Sydney Gallery",
    ]);

    const fallbackTransport: AgentProposal = {
      ...roundTripTransport,
      items: [
        { ...roundTripTransport.items[0]!, startTime: "16:30", endTime: "18:50" },
        { ...roundTripTransport.items[1]!, startTime: "12:00", endTime: "13:30" },
      ],
    };
    const fallback = await createItineraryAgent({ generator: false }).invoke({
      brief: trip,
      context: ctx,
      board: { proposals: [fallbackTransport, accommodation] },
    });
    expect(fallback.items.filter(({ day }) => day === 1).map(({ location }) => location)).toEqual([
      "Sydney Museum",
      "Wollongong Gallery",
    ]);
  });

  it("does not reuse the origin city after a disconnected transfer chain", async () => {
    const trip = {
      ...brief,
      destination: "Sydney & Wollongong & Canberra",
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
      summary: "Transfer from Sydney to Canberra via Wollongong",
      items: [
        {
          kind: "transport",
          day: 1,
          location: "Wollongong → Canberra",
          detail: "Untimed onward transfer",
        },
        {
          kind: "transport",
          day: 1,
          startTime: "09:00",
          endTime: "11:00",
          location: "Sydney → Wollongong",
          detail: "Timed first transfer",
        },
      ],
      assumptions: [],
      conflictsWith: [],
    };
    const accommodation: AgentProposal = {
      agent: "accommodation",
      summary: "Canberra then Sydney stays",
      items: [],
      assumptions: [],
      conflictsWith: [],
      stays: [
        {
          id: "canberra-stay",
          city: "Canberra",
          checkIn: "2026-12-16",
          checkOut: "2026-12-17",
          day: 1,
          nights: 1,
          rooms: 1,
          selectedId: "canberra-candidate",
          candidates: [
            {
              id: "canberra-candidate",
              name: "Canberra Standard",
              area: "Canberra",
              pricePerNight: 200,
              rating: 8,
              freeCancellation: true,
            },
          ],
        },
        {
          id: "sydney-stay",
          city: "Sydney",
          checkIn: "2026-12-17",
          checkOut: "2026-12-20",
          day: 2,
          nights: 3,
          rooms: 1,
          selectedId: "sydney-candidate",
          candidates: [
            {
              id: "sydney-candidate",
              name: "Sydney Standard",
              area: "Sydney",
              pricePerNight: 200,
              rating: 8,
              freeCancellation: true,
            },
          ],
        },
      ],
    };
    const generator: ItineraryGenerator = {
      generate: vi.fn(async () => ({
        summary: "Visit Sydney after the disconnected transfer chain",
        activities: [
          {
            day: 2,
            startTime: "09:00",
            endTime: "10:00",
            location: "Sydney Museum",
            detail: "This must not be allowed based on the stale origin city",
          },
          {
            day: 3,
            startTime: "09:00",
            endTime: "10:00",
            location: "Sydney Museum",
            detail: "The transfer chain remains unresolved",
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

    expect(result.items.filter(({ day }) => day === 2)).toEqual([]);
  });
});
