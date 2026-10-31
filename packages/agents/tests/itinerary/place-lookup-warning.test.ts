import { describe, expect, it, vi } from "vitest";
import type { AgentContext, TripBrief } from "@trip/shared";
import { createItineraryAgent } from "../../src/itinerary";

const brief: TripBrief = {
  tripId: "place-lookup-warning",
  userId: "traveller",
  destination: "Tokyo",
  dates: ["2026-12-10", "2026-12-11"],
  groupSize: 2,
  budgetTotal: 4000,
};

function context(): AgentContext {
  return {
    tripId: brief.tripId,
    round: 1,
    tools: {
      maps: {
        places: vi.fn(async ({ category }) => {
          if (category === "neighborhood") throw new Error("Overpass request failed (502)");
          return category === "sight" ? [{ name: "Senso-ji", category: "sight" }] : [];
        }),
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

describe("a failed place lookup reaches the server log", () => {
  it("warns with the category, the city and the provider's reason", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await createItineraryAgent({ generator: false }).invoke({
      brief,
      context: context(),
    });

    expect(warn).toHaveBeenCalledWith(
      "[itinerary] Place provider unavailable for neighborhood in Tokyo: Overpass request failed (502)",
    );
    expect(result.items.length).toBeGreaterThan(0);
    warn.mockRestore();
  });
});
