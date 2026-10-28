import { describe, expect, it, vi } from "vitest";
import {
  AgentProposal,
  type AgentContext,
  type TripBrief,
  type UserPreference,
} from "@trip/shared";
import {
  createDestinationGuideAgent,
  type DestinationGuideGenerator,
} from "../../src/destination-guide";

const brief: TripBrief = {
  tripId: "guide-test",
  userId: "traveller",
  destination: "Kyoto",
  dates: ["2026-10-01", "2026-10-03"],
  groupSize: 2,
  budgetTotal: 2000,
  nationality: "Australian",
};

function context(
  preferences: UserPreference[] = [],
  withPlaces = true,
  withLocation = false,
): AgentContext {
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
                  ...(withLocation ? { location: { latitude: 35.0116, longitude: 135.7681 } } : {}),
                },
              ]
            : [],
        ),
        route: vi.fn(async () => []),
      },
      booking: { searchStays: vi.fn(async () => []), searchFlights: vi.fn(async () => []) },
      weather: undefined,
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
    const result = await createDestinationGuideAgent({ generator: false }).invoke({
      brief,
      context: ctx,
    });
    expect(AgentProposal.safeParse(result).success).toBe(true);
    expect(result.summary).not.toContain("STUB");
    expect(result.items.filter((item) => item.kind === "attraction")).toHaveLength(1);
    expect(result.items.length).toBeLessThanOrEqual(5);
    expect(result.items.find((item) => item.kind === "entry-health")?.detail).toContain(
      "Australian passport",
    );
    expect(result.assumptions.join(" ")).toContain("Destination-specific claims are limited");
    expect(ctx.tools.maps.places).toHaveBeenCalledTimes(2);
    expect(ctx.mem.getLongTerm).toHaveBeenCalledWith("traveller");
  });

  it("labels entry guidance for the traveller nationality and weather as planning context", async () => {
    const result = await createDestinationGuideAgent({ generator: false }).invoke({
      brief,
      context: context(),
    });
    const entryHealth = result.items.find((item) => item.kind === "entry-health")?.detail ?? "";
    const weatherPacking =
      result.items.find((item) => item.kind === "weather-packing")?.detail ?? "";

    expect(entryHealth).toContain("Australian passport");
    expect(result.assumptions.join(" ")).toContain("official government sources");
    expect(weatherPacking).toContain("planning context only");
    expect(result.assumptions.join(" ")).toContain("not a forecast");
  });

  it("uses a schema-valid MiniMax draft grounded in supplied places", async () => {
    const generate = vi.fn(async () => validDraft);
    const generator: DestinationGuideGenerator = { generate };
    const result = await createDestinationGuideAgent({ generator }).invoke({
      brief,
      context: context(),
    });
    expect(result.assumptions.join(" ")).not.toContain("LangChain");
    expect(result.items[0]).toMatchObject({ kind: "attraction", location: "Temple Walk" });
    expect(result.items.find((item) => item.kind === "weather-packing")?.packing).toEqual([
      "Layers",
      "Walking shoes",
    ]);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ travelMonth: "October", brief }),
    );
  });

  it("uses weather evidence when map candidates provide coordinates", async () => {
    const ctx = context([], true, true);
    const forecast = vi.fn(async ({ targetDate }: { targetDate: string }) => ({
      horizon: "forecast" as const,
      targetDate,
      summary: "Sunny, 24–14°C. Forecast conditions can change before departure.",
      observedAt: "2026-09-21T00:00:00.000Z",
      validUntil: "2026-10-02T00:00:00.000Z",
      provider: "Google Weather API",
    }));
    ctx.tools.weather = { forecast };

    const result = await createDestinationGuideAgent({
      generator: { generate: vi.fn(async () => validDraft) },
    }).invoke({ brief, context: ctx });

    expect(forecast).toHaveBeenCalledWith({
      location: { latitude: 35.0116, longitude: 135.7681 },
      targetDate: "2026-10-01",
    });
    expect(result.items.find((item) => item.kind === "weather-packing")?.detail).toContain(
      "Sunny, 24–14°C",
    );
    expect(result.assumptions.join(" ")).toContain("Google Weather API");
    expect(result.source).toMatchObject({ kind: "live", label: "Google Weather API" });
  });

  it("canonicalizes grounded attraction names before returning them", async () => {
    const generator: DestinationGuideGenerator = {
      generate: vi.fn(async () => ({
        ...validDraft,
        attractions: [{ name: "  temple walk ", detail: "A candidate cultural stop." }],
      })),
    };

    const result = await createDestinationGuideAgent({ generator }).invoke({
      brief,
      context: context(),
    });

    expect(result.items[0]).toMatchObject({
      kind: "attraction",
      location: "Temple Walk",
    });
  });

  it("deduplicates repeated attraction names after canonicalization", async () => {
    const generator: DestinationGuideGenerator = {
      generate: vi.fn(async () => ({
        ...validDraft,
        attractions: [
          { name: "Temple Walk", detail: "A candidate cultural stop." },
          { name: "  temple walk  ", detail: "Duplicate entry." },
        ],
      })),
    };

    const result = await createDestinationGuideAgent({ generator }).invoke({
      brief,
      context: context(),
    });

    expect(result.items.filter((item) => item.kind === "attraction")).toHaveLength(1);
    expect(result.items.find((item) => item.kind === "attraction")?.location).toBe("Temple Walk");
  });

  it("deduplicates the same place returned by multiple map categories", async () => {
    const generate = vi.fn(async ({ places }: { places: Array<{ name: string }> }) => {
      expect(places.map((place) => place.name)).toEqual(["Temple Walk", "City Museum"]);
      return validDraft;
    });
    const ctx = context();
    ctx.tools.maps.places = vi.fn(async ({ category }) =>
      category === "museum"
        ? [
            { name: "Temple Walk", category: "museum" },
            { name: "City Museum", category },
          ]
        : [{ name: "Temple Walk", category: "sight" }],
    );

    await createDestinationGuideAgent({ generator: { generate } }).invoke({
      brief,
      context: ctx,
    });

    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("falls back instead of accepting a hallucinated attraction", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const generator: DestinationGuideGenerator = {
      generate: vi.fn(async () => ({
        ...validDraft,
        attractions: [{ name: "Invented Palace", detail: "Not in MapsPort." }],
      })),
    };
    const result = await createDestinationGuideAgent({ generator }).invoke({
      brief,
      context: context(),
    });
    expect(result.assumptions.join(" ")).toContain("Destination-specific claims are limited");
    expect(result.items.map((item) => item.location).filter(Boolean)).not.toContain(
      "Invented Palace",
    );
    expect(result.source).toMatchObject({ kind: "fallback", label: "Local fallback" });
    warning.mockRestore();
  });

  it("normalises packing items without trailing punctuation or empty entries", async () => {
    const result = await createDestinationGuideAgent({
      generator: {
        generate: vi.fn(async () => ({
          ...validDraft,
          packing: [
            "Light layers: t-shirts and a rain jacket.",
            "Walking shoes!",
            "Sunscreen and a hat",
          ],
        })),
      },
    }).invoke({ brief, context: context() });
    const item = result.items.find((entry) => entry.kind === "weather-packing");
    expect(item?.packing).toEqual([
      "Light layers: t-shirts and a rain jacket",
      "Walking shoes",
      "Sunscreen and a hat",
    ]);
    expect(item?.detail).not.toContain("Pack:");
  });

  it("does not invent attractions when MapsPort returns none", async () => {
    const result = await createDestinationGuideAgent({ generator: false }).invoke({
      brief,
      context: context([], false),
    });
    expect(result.items.some((item) => item.kind === "attraction")).toBe(false);
    expect(result.items.some((item) => item.kind === "weather-packing")).toBe(true);
  });

  it("rejects an invalid departure date before calling tools", async () => {
    const ctx = context();
    await expect(
      createDestinationGuideAgent({ generator: false }).invoke({
        brief: { ...brief, dates: ["2026-02-30", "2026-03-02"] },
        context: ctx,
      }),
    ).rejects.toThrow("Enter a real date");
    expect(ctx.tools.maps.places).not.toHaveBeenCalled();
  });

  it("honours cancellation before calling tools", async () => {
    const ctx = context();
    const controller = new AbortController();
    controller.abort();
    await expect(
      createDestinationGuideAgent({ generator: false }).invoke({
        brief,
        context: { ...ctx, signal: controller.signal },
      }),
    ).rejects.toThrow();
    expect(ctx.tools.maps.places).not.toHaveBeenCalled();
  });
});
