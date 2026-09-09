import { describe, expect, it, vi } from "vitest";
import type { Agent, ChatRunProgress, MemoryStore, ToolGateway, TripBrief } from "@trip/shared";
import {
  applyBriefPatch,
  extractBriefPatchLocally,
  runTripIntake,
  runTripChat,
  type BriefExtractor,
} from "./chat";

const brief: TripBrief = {
  tripId: "chat-test",
  userId: "chat-user",
  destination: "Tokyo",
  dates: ["2026-06-15", "2026-06-22"],
  groupSize: 2,
  budgetTotal: 4000,
};

describe("local TripBrief extraction", () => {
  it("extracts explicit English trip fields without a model", () => {
    expect(
      extractBriefPatchLocally(
        "Plan a trip to Sydney for 3 people, 2026-10-01 to 2026-10-05, budget $2,500",
      ),
    ).toEqual({
      destination: "Sydney",
      dates: ["2026-10-01", "2026-10-05"],
      groupSize: 3,
      budgetTotal: 2500,
    });
  });

  it("extracts explicit Chinese updates", () => {
    expect(
      extractBriefPatchLocally(
        "2026-10-01 至 2026-10-05 去悉尼，预算改成 3000，两个人，澳大利亚护照",
      ),
    ).toEqual({
      destination: "悉尼",
      dates: ["2026-10-01", "2026-10-05"],
      groupSize: 2,
      budgetTotal: 3000,
      nationality: "澳大利亚",
    });
  });

  it("supports the concise format shown in the chat placeholder", () => {
    expect(
      extractBriefPatchLocally("Sydney, 2026-10-01 to 2026-10-05, 2 people, budget $3000."),
    ).toMatchObject({ destination: "Sydney", groupSize: 2, budgetTotal: 3000 });
  });

  it("supports incremental destination and budget wording", () => {
    expect(
      extractBriefPatchLocally("Change the destination to Sydney and budget to $3000"),
    ).toEqual({ destination: "Sydney", budgetTotal: 3000 });
  });

  it("understands a natural-language relative date window", () => {
    const patch = extractBriefPatchLocally("从明天开始去 3 天");
    expect(patch.dates?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(patch.dates?.[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps unmentioned fields and rejects impossible date ranges", () => {
    expect(applyBriefPatch(brief, { budgetTotal: 3000 }, brief.tripId)).toEqual({
      ...brief,
      budgetTotal: 3000,
    });
    expect(() =>
      applyBriefPatch(brief, { dates: ["2026-02-30", "2026-03-05"] }, brief.tripId),
    ).toThrow("real dates");
    expect(() =>
      applyBriefPatch(brief, { dates: ["2026-10-05", "2026-10-01"] }, brief.tripId),
    ).toThrow("after");
  });
});

describe("trip chat workflow", () => {
  it("lets the intake agent decide when a destination needs more detail", async () => {
    const result = await runTripIntake({ tripId: "intake-1", message: "Sydney" });

    expect(result.ready).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.draft).toMatchObject({ tripId: "intake-1", destination: "Sydney" });
    expect(result.reply).toContain("dates");
  });

  it("creates a new trip from the first destination message and saves the latest plan", async () => {
    const savedTrips: unknown[] = [];
    const turns: Array<{ role: string; content: string }> = [];
    const mem: MemoryStore = {
      getShortTerm: vi.fn(async () => []),
      appendShortTerm: vi.fn(async (_tripId, turn) => {
        turns.push(turn);
      }),
      getLongTerm: vi.fn(async () => []),
      setLongTerm: vi.fn(async () => {}),
      promote: vi.fn(async () => {}),
      getTrip: vi.fn(async () => undefined),
      saveTrip: vi.fn(async (trip) => {
        savedTrips.push(trip);
      }),
    };
    const tools: ToolGateway = {
      maps: { route: vi.fn(async () => []), places: vi.fn(async () => []) },
      booking: { searchStays: vi.fn(async () => []), searchFlights: vi.fn(async () => []) },
    };
    const itinerary: Agent = {
      name: "itinerary",
      label: "Day plan",
      async run(created) {
        return {
          agent: "itinerary",
          summary: `Plan for ${created.destination}`,
          items: [{ kind: "activity", detail: "Harbour walk", estCost: 100 }],
          assumptions: [],
          conflictsWith: [],
        };
      },
    };

    const result = await runTripChat(
      { tripId: "new-trip", message: "Sydney" },
      { agents: [itinerary], tools, mem },
    );

    expect(result.plan.brief).toMatchObject({
      tripId: "new-trip",
      userId: "demo-user",
      destination: "Sydney",
      groupSize: 1,
      budgetTotal: 3000,
    });
    expect(turns.map((turn) => turn.role)).toEqual(["user", "assistant"]);
    expect(savedTrips).toHaveLength(2);
    expect(savedTrips[0]).toMatchObject({ title: "Sydney", plan: null });
    expect(savedTrips[1]).toMatchObject({
      title: "Sydney",
      plan: { tripId: "new-trip", brief: { destination: "Sydney" } },
    });
  });

  it("requires a destination before starting a new trip", async () => {
    await expect(
      runTripChat(
        { tripId: "new-trip", message: "Please help me plan" },
        {
          extractor: { extract: vi.fn(async () => ({})) },
          mem: {
            getShortTerm: vi.fn(async () => []),
            appendShortTerm: vi.fn(async () => {}),
            getLongTerm: vi.fn(async () => []),
            setLongTerm: vi.fn(async () => {}),
            promote: vi.fn(async () => {}),
          },
        },
      ),
    ).rejects.toThrow("Tell me a destination");
  });

  it("applies an injected structured extractor, records both turns and replans", async () => {
    const extractor: BriefExtractor = {
      extract: vi.fn(async () => ({ destination: "Melbourne", budgetTotal: 5000 })),
    };
    const turns: Array<{ role: string; content: string }> = [];
    const progress: ChatRunProgress[] = [];
    const mem: MemoryStore = {
      getShortTerm: vi.fn(async () => []),
      appendShortTerm: vi.fn(async (_tripId, turn) => {
        turns.push(turn);
      }),
      getLongTerm: vi.fn(async () => []),
      setLongTerm: vi.fn(async () => {}),
      promote: vi.fn(async () => {}),
    };
    const tools: ToolGateway = {
      maps: { route: vi.fn(async () => []), places: vi.fn(async () => []) },
      booking: { searchStays: vi.fn(async () => []), searchFlights: vi.fn(async () => []) },
    };
    const itinerary: Agent = {
      name: "itinerary",
      label: "Day plan",
      async run(updated) {
        return {
          agent: "itinerary",
          summary: `Plan for ${updated.destination}`,
          items: [{ kind: "activity", detail: "Walk", estCost: 100 }],
          assumptions: [],
          conflictsWith: [],
        };
      },
    };

    const result = await runTripChat(
      { tripId: brief.tripId, message: "Please change the destination", brief },
      { extractor, agents: [itinerary], tools, mem, onProgress: (event) => progress.push(event) },
    );

    expect(extractor.extract).toHaveBeenCalledWith("Please change the destination", brief);
    expect(result.plan.brief).toMatchObject({ destination: "Melbourne", budgetTotal: 5000 });
    expect(result.reply).toContain("Updated: destination, budgetTotal");
    expect(turns.map((turn) => turn.role)).toEqual(["user", "assistant"]);
    expect(progress[0]).toMatchObject({
      phase: "decomposing",
      agent: { id: "coordinator", status: "running", usage: null },
    });
    expect(progress.at(-1)).toMatchObject({ phase: "complete" });
  });
});
