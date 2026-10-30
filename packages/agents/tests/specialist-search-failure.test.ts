import { FakeToolCallingModel } from "langchain";
import { describe, expect, it, vi } from "vitest";
import type { AgentContext, TripBrief } from "@trip/shared";

const routed = vi.hoisted(() => ({ model: undefined as unknown }));
vi.mock("../src/models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/models")>()),
  createRoutedChatModel: () => routed.model,
}));

import { accommodationAgent } from "../src/accommodation";

const brief: TripBrief = {
  tripId: "search-failure",
  userId: "user",
  destination: "Sydney",
  dates: ["2026-11-20", "2026-11-23"],
  groupSize: 2,
  budgetTotal: 3000,
};

function context(searchStays: AgentContext["tools"]["booking"]["searchStays"]): AgentContext {
  return {
    tripId: brief.tripId,
    round: 1,
    tools: {
      booking: {
        searchStays,
        searchFlights: vi.fn(async () => []),
      },
      maps: { route: vi.fn(async () => []), places: vi.fn(async () => []) },
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

function modelCallingSearchRepeatedly() {
  const call = { name: "search_accommodation_candidates", args: {}, id: "call" };
  routed.model = new FakeToolCallingModel({ toolCalls: Array.from({ length: 40 }, () => [call]) });
}

describe("accommodation provider search", () => {
  it("stops after one failed search and reports the provider error", async () => {
    modelCallingSearchRepeatedly();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const searchStays = vi.fn(async () => {
      throw new Error("provider down");
    });
    await expect(
      accommodationAgent.invoke({ brief, context: context(searchStays) }),
    ).rejects.toThrow("provider down");
    expect(searchStays).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("reuses the first result when the model searches again", async () => {
    modelCallingSearchRepeatedly();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const searchStays = vi.fn(async () => [
      { name: "Stay", area: "CBD", pricePerNight: 100, rating: 8.5, freeCancellation: true },
    ]);
    const proposal = await accommodationAgent.invoke({ brief, context: context(searchStays) });
    expect(searchStays).toHaveBeenCalledTimes(1);
    expect(proposal.source?.kind).toBe("fallback");
    warn.mockRestore();
  });
});
