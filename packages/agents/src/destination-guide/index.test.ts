import { describe, expect, it, vi } from "vitest";
import {
  AgentProposal,
  type AgentContext,
  type TripBrief,
  type UserPreference,
} from "@trip/shared";
import { createDestinationGuideAgent, type DestinationGuideGenerator } from "./index";

const brief: TripBrief = {
  tripId: "guide-test",
  userId: "traveller",
  destination: "Kyoto",
  dates: ["2026-10-01", "2026-10-03"],
  groupSize: 2,
  budgetTotal: 2000,
  nationality: "Australian",
};

function context(preferences: UserPreference[] = [], withPlaces = true): AgentContext {
  return {
    tripId: brief.tripId,
    round: 1,
    tools: {
      maps: {
        places: vi.fn(async ({ category }) =>
          withPlaces
            ? [
                {
                  name: category === "museum" ? "City Museum" : "Temple Walk",
                  category: category ?? "sight",
                  rating: 4.6,
                },
              ]
            : [],
        ),
        route: vi.fn(async () => []),
      },
      booking: { searchStays: vi.fn(async () => []), searchFlights: vi.fn(async () => []) },
    },
    mem: {
      getLongTerm: vi.fn(async () => preferences),
      getShortTerm: vi.fn(async () => []),
      appendShortTerm: vi.fn(async () => {}),
      setLongTerm: vi.fn(async () => {}),
      promote: vi.fn(async () => {}),
    },
  };
}

const validDraft = {
  summary: "A grounded Kyoto guide",
  attractions: [{ name: "Temple Walk", detail: "A candidate cultural stop." }],
  customs: ["Follow posted etiquette."],
  safety: ["Follow current official advisories."],
  entryHealth: ["Check official entry and health rules."],
  weather: "October is planning context only; check a current forecast.",
  packing: ["Layers", "Walking shoes"],
  assumptions: ["Candidate data may change."],
};

describe("destination guide", () => {
  it("builds a useful grounded fallback without a model", async () => {
    const ctx = context();
    const result = await createDestinationGuideAgent({ generator: false }).run(brief, ctx);
    expect(AgentProposal.safeParse(result).success).toBe(true);
    expect(result.summary).not.toContain("STUB");
    expect(result.items.filter((item) => item.kind === "attraction")).toHaveLength(2);
    expect(result.items.find((item) => item.kind === "entry-health")?.detail).toContain(
      "Australian passport",
    );
    expect(result.model).toBe("Deterministic fallback");
    expect(ctx.tools.maps.places).toHaveBeenCalledTimes(2);
    expect(ctx.mem.getLongTerm).toHaveBeenCalledWith("traveller");
  });

  it("uses a schema-valid injected draft grounded in supplied places", async () => {
    const generate = vi.fn(async () => validDraft);
    const generator: DestinationGuideGenerator = { generate };
    const result = await createDestinationGuideAgent({ generator }).run(brief, context());
    expect(result.model).toBe("Injected generator");
    expect(result.items[0]).toMatchObject({ kind: "attraction", location: "Temple Walk" });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ travelMonth: "October", brief }),
    );
  });

  it("falls back instead of accepting a hallucinated attraction", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const generator: DestinationGuideGenerator = {
      generate: vi.fn(async () => ({
        ...validDraft,
        attractions: [{ name: "Invented Palace", detail: "Not in MapsPort." }],
      })),
    };
    const result = await createDestinationGuideAgent({ generator }).run(brief, context());
    expect(result.model).toBe("Deterministic fallback");
    expect(result.items.map((item) => item.location).filter(Boolean)).not.toContain(
      "Invented Palace",
    );
    warning.mockRestore();
  });

  it("does not invent attractions when MapsPort returns none", async () => {
    const result = await createDestinationGuideAgent({ generator: false }).run(
      brief,
      context([], false),
    );
    expect(result.items.some((item) => item.kind === "attraction")).toBe(false);
    expect(result.items.some((item) => item.kind === "weather-packing")).toBe(true);
  });

  it("rejects an invalid departure date before calling tools", async () => {
    const ctx = context();
    await expect(
      createDestinationGuideAgent({ generator: false }).run(
        { ...brief, dates: ["2026-02-30", "2026-03-02"] },
        ctx,
      ),
    ).rejects.toThrow("valid YYYY-MM-DD");
    expect(ctx.tools.maps.places).not.toHaveBeenCalled();
  });

  it("honours cancellation before calling tools", async () => {
    const ctx = context();
    const controller = new AbortController();
    controller.abort();
    await expect(
      createDestinationGuideAgent({ generator: false }).run(brief, {
        ...ctx,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(ctx.tools.maps.places).not.toHaveBeenCalled();
  });
});
