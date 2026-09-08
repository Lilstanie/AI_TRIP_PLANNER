import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentContext, TripBrief, UserPreference } from "@trip/shared";
import { chatJsonOrNull } from "@trip/llm";
import { diningAgent } from "./index";

vi.mock("@trip/llm"); // auto-mock: every export becomes a vi.fn()
const mockChat = vi.mocked(chatJsonOrNull);

beforeEach(() => vi.clearAllMocks());

const brief: TripBrief = {
  tripId: "dining-test",
  userId: "user-1",
  destination: "Kyoto",
  dates: ["2026-06-19", "2026-06-22"],
  groupSize: 2,
  budgetTotal: 4000,
};

function context(prefs: UserPreference[] = []): AgentContext {
  return {
    tripId: brief.tripId,
    round: 1,
    tools: {
      booking: { searchStays: vi.fn(), searchFlights: vi.fn() },
      maps: { route: vi.fn(), places: vi.fn() },
    },
    mem: {
      getLongTerm: vi.fn(async () => prefs),
      getShortTerm: vi.fn(async () => []),
      appendShortTerm: vi.fn(async () => {}),
      setLongTerm: vi.fn(async () => {}),
      promote: vi.fn(async () => {}),
    },
  };
}

describe("DiningAgent", () => {
  it("uses the LLM picks when the call succeeds", async () => {
    mockChat.mockResolvedValueOnce({
      picks: [
        { name: "Nishiki Market", cuisine: "street food", note: "go early" },
        { name: "AWOMB", cuisine: "temari-zushi" },
      ],
    });
    const result = await diningAgent.run(brief, context());
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.detail).toContain("Nishiki Market");
    expect(result.items.every((i) => i.estCost === 0)).toBe(true);
    expect(result.summary).toContain("2 food picks");
  });

  it("passes a dietary requirement from long-term memory into the prompt", async () => {
    mockChat.mockResolvedValueOnce({ picks: [{ name: "X" }] });
    await diningAgent.run(brief, context([{ key: "diet", value: "vegetarian", source: "filter" }]));
    const messages = mockChat.mock.calls.at(-1)![0];
    expect(messages[1]!.content).toContain("vegetarian");
  });

  it("falls back to a generic note when the LLM call fails (returns null)", async () => {
    mockChat.mockResolvedValueOnce(null);
    const result = await diningAgent.run(brief, context());
    expect(result.summary).toContain("offline fallback");
    expect(result.items).toHaveLength(1);
    expect(result.assumptions.join(" ")).toContain("unavailable");
  });

  it("honours an already-aborted signal before calling the LLM", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      diningAgent.run(brief, { ...context(), signal: controller.signal }),
    ).rejects.toThrow();
    expect(mockChat).not.toHaveBeenCalled();
  });
});
