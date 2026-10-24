import { describe, expect, it, vi } from "vitest";
import type { AgentContext, TripBrief } from "@trip/shared";
import { summaryCopy } from "../src/summary-copy";
import { createDestinationGuideAgent } from "../src/destination-guide";

const stay = {
  rooms: 1,
  nights: 4,
  cities: ["Tokyo", "Kyoto"],
  money: "A$1,200",
  lowestCost: true,
};
const transport = {
  options: 2,
  origin: "Sydney",
  destinations: ["Tokyo", "Kyoto"],
  money: "A$900",
  unpriced: 1,
  unavailable: 1,
  incomplete: true,
};
const without = (text: string, ...kept: string[]) =>
  kept.reduce((rest, value) => rest.split(value).join(""), text);

describe("specialist summary copy", () => {
  it("keeps every English summary byte-for-byte", () => {
    const en = summaryCopy("en");
    expect(en.stays(stay)).toBe(
      "1 room, 4 nights in Tokyo & Kyoto · A$1,200 (lowest eligible cost)",
    );
    expect(en.stays({ ...stay, lowestCost: false })).toBe(
      "1 room, 4 nights in Tokyo & Kyoto · A$1,200",
    );
    expect(en.bookedStay("Park Hotel", 3)).toBe(
      "Park Hotel · booked by you, 3 nights · not priced",
    );
    expect(en.guide("Kyoto", "2026-10-01")).toBe("Kyoto planning guidance for October");
    expect(en.dining("Two picks", "A$300")).toBe("Two picks · A$300 meal budget");
    expect(en.diningCandidates(3)).toBe(
      "3 grounded dining candidates within a whole-trip meal budget envelope",
    );
    expect(en.diningCandidates(0)).toBe(
      "No grounded dining candidates; using a whole-trip meal budget envelope",
    );
    expect(en.itinerary(4, "Kyoto", 1)).toBe(
      "4-day plan for Kyoto with up to 1 grounded activity per day",
    );
    expect(en.itinerary(4, "Kyoto", 2)).toBe(
      "4-day plan for Kyoto with up to 2 grounded activities per day",
    );
    expect(en.transport(transport)).toBe(
      "2 transport options for Sydney ↔ Tokyo → Kyoto · known estimate A$900 · 1 leg unpriced · 1 travel choice unavailable (incomplete/unverified)",
    );
    expect(en.transport({ ...transport, unpriced: 0, unavailable: 0, incomplete: false })).toBe(
      "2 transport options for Sydney ↔ Tokyo → Kyoto · known estimate A$900",
    );
    expect(
      en.weather("Tokyo", "2027-06-18", { horizon: "forecast", summary: "Rain, 8–14°C." }),
    ).toBe("Tokyo, Fri, 18 June (forecast): Rain, 8–14°C.");
    expect(en.weather("Tokyo", "2027-06-18", { horizon: "climate", summary: "Mild." })).toBe(
      "Tokyo, Fri, 18 June (historical climate, not a forecast): Mild.",
    );
    expect(en.diningPick("restaurant", 4.5, "")).toBe(
      "restaurant candidate with supplied rating 4.5. Confirm ingredients and dietary suitability directly with the venue.",
    );
    expect(en.diningPick("restaurant", undefined, "dietary=vegetarian")).toBe(
      "restaurant candidate. Ask the venue to confirm these requirements directly: dietary=vegetarian.",
    );
    expect(en.suggestedStop("Temple Walk", "sight")).toBe(
      "Temple Walk (sight) is a suggested stop; confirm timing and suitability before visiting.",
    );
    expect(en.attraction("sight", 4.5)).toBe(
      "sight candidate with supplied rating 4.5; verify opening hours and suitability before visiting.",
    );
    expect(en.entryHealth("Australian")).toBe(
      "Check current official immigration and public-health requirements for a Australian passport; requirements can change.",
    );
    expect(en.monthScope("2026-10-30", "2026-11-02")).toBe(
      "Planning context for October 2026 only; recheck guidance for the remaining months through November 2026. ",
    );
    expect(en.weather("Tokyo", "2027-06-16")).toBe(
      "Tokyo, Wed, 16 June: weather unavailable; check a current forecast before travel.",
    );
  });

  it("falls back to English when no reply language is set", () => {
    expect(summaryCopy(undefined)).toBe(summaryCopy("en"));
  });

  it("writes Chinese summaries with no English template words and every value kept", () => {
    const zh = summaryCopy("zh");
    const lines = [
      [zh.stays(stay), "A$1,200", "Tokyo", "Kyoto"],
      [zh.bookedStay("Park Hotel", 3), "Park Hotel"],
      [zh.guide("Kyoto", "2026-10-01"), "Kyoto"],
      [zh.dining("两家餐厅", "A$300"), "A$300"],
      [zh.diningCandidates(3)],
      [zh.diningCandidates(0)],
      [zh.itinerary(4, "Kyoto", 2), "Kyoto"],
      [zh.itineraryNeedsPlaces],
      [zh.transportIncomplete],
      [zh.transportNone],
      [zh.transport(transport), "A$900", "Sydney", "Tokyo", "Kyoto"],
      [
        zh.weather("Tokyo", "2027-06-18", { horizon: "forecast", summary: "Rain, 8–14°C." }),
        "Tokyo",
        "Rain, 8–14°C.",
      ],
      [
        zh.weather("Tokyo", "2027-06-18", { horizon: "climate", summary: "Mild." }),
        "Tokyo",
        "Mild.",
      ],
      [zh.weather("Tokyo", "2027-06-16"), "Tokyo"],
      [zh.attraction("sight", 4.5), "4.5"],
      [zh.attraction("sight")],
      [zh.suggestedStop("Temple Walk", "sight"), "Temple Walk"],
      [zh.diningPick("restaurant", 4.5, ""), "4.5"],
      [zh.diningPick("restaurant", undefined, "dietary=vegetarian"), "dietary=vegetarian"],
      [zh.customs],
      [zh.safety],
      [zh.entryHealth("Australian"), "Australian"],
      [zh.entryHealth()],
      [zh.entryHealthVerify],
      [zh.monthlyWeather("2026-10-01")],
      [zh.monthScope("2026-10-30", "2026-11-02")],
      [zh.packingRain],
      [zh.packingCold],
      [zh.packingHeat],
      [zh.packingLayers],
      ...zh.packingBasics.map((item) => [item]),
    ];
    for (const [line, ...kept] of lines) {
      for (const value of kept) expect(line).toContain(value);
      expect(without(line!, ...kept)).not.toMatch(/[A-Za-z]/);
    }
    expect(zh.stays(stay)).toMatch(/Tokyo、Kyoto/);
    expect(zh.transport(transport)).toContain("Tokyo → Kyoto");
    expect(zh.guide("Kyoto", "2026-10-01")).toContain("十月");
    const header = new Intl.DateTimeFormat("zh-CN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(Date.parse("2027-06-18T00:00:00Z"));
    expect(zh.weather("Tokyo", "2027-06-18", { horizon: "forecast", summary: "Rain." })).toBe(
      `Tokyo，${header}（预报）：Rain.`,
    );
    expect(header).toBe("6月18日周五");
    expect(zh.weather("Tokyo", "2027-06-16")).toContain("6月16日周三");
    expect(zh.monthScope("2026-10-30", "2026-11-02")).toContain("2026年10月");
    expect(zh.monthlyWeather("2026-10-01")).toContain("十月");
  });

  it("shows optional Chinese parts only when present", () => {
    const zh = summaryCopy("zh");
    expect(zh.stays(stay)).toContain("最低可选价格");
    expect(zh.stays({ ...stay, lowestCost: false })).not.toContain("最低可选价格");
    const full = zh.transport(transport);
    expect(full).toContain("1 段未计价");
    expect(full).toContain("1 个出行选择不可用");
    expect(full).toContain("不完整/未核实");
    const bare = zh.transport({ ...transport, unpriced: 0, unavailable: 0, incomplete: false });
    expect(bare).not.toMatch(/未计价|不可用|未核实/);
  });
});

describe("specialist reply language", () => {
  const brief: TripBrief = {
    tripId: "copy-test",
    userId: "traveller",
    destination: "京都",
    dates: ["2026-10-01", "2026-10-03"],
    groupSize: 2,
    budgetTotal: 2000,
  };
  const context = (replyLanguage?: "en" | "zh"): AgentContext => ({
    tripId: brief.tripId,
    round: 1,
    ...(replyLanguage ? { replyLanguage } : {}),
    tools: {
      maps: {
        places: vi.fn(async () => [{ name: "Temple Walk", category: "sight" }]),
        route: vi.fn(async () => []),
      },
      booking: { searchStays: vi.fn(async () => []), searchFlights: vi.fn(async () => []) },
      weather: undefined,
    },
    mem: {
      getLongTerm: vi.fn(async () => []),
      getShortTerm: vi.fn(async () => []),
      appendShortTerm: vi.fn(async () => {}),
      setLongTerm: vi.fn(async () => {}),
      promote: vi.fn(async () => {}),
    },
  });

  it("writes the fallback guide summary in the turn's reply language", async () => {
    const agent = createDestinationGuideAgent({ generator: false });
    const zh = await agent.invoke({ brief, context: context("zh") });
    const none = await agent.invoke({ brief, context: context() });
    expect(zh.summary).toBe("京都十月出行指南");
    expect(none.summary).toBe("京都 planning guidance for October");
  });
});
