import { describe, expect, it, vi } from "vitest";
import type { AgentContext, TripBrief } from "@trip/shared";
import { replyLanguageRule } from "../src/prompts/reply-language";
import {
  createDestinationGuideAgent,
  type DestinationGuideGenerator,
} from "../src/destination-guide";
import { createDiningAgent, type DiningGenerator } from "../src/dining";

const brief: TripBrief = {
  tripId: "prompt-test",
  userId: "traveller",
  destination: "Kyoto",
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

describe("reply language rule", () => {
  it("adds nothing for a caller with no reply language", () => {
    expect(replyLanguageRule(undefined)).toBe("");
  });

  it("names the language and keeps names, ids and amounts untranslated", () => {
    const rule = replyLanguageRule("zh");
    expect(rule).toContain("Simplified Chinese");
    expect(rule).toMatch(/names, ids, dates, codes and amounts exactly as given; never translate/);
  });
});

describe("specialist generators", () => {
  it("receive the turn's reply language, and nothing when it is absent", async () => {
    const guide = vi.fn<DestinationGuideGenerator["generate"]>(async () => {
      throw new Error("no model");
    });
    const dining = vi.fn<DiningGenerator["generate"]>(async () => {
      throw new Error("no model");
    });
    for (const language of ["zh", undefined] as const) {
      await createDestinationGuideAgent({ generator: { generate: guide } }).invoke({
        brief,
        context: context(language),
      });
      await createDiningAgent({ generator: { generate: dining } }).invoke({
        brief,
        context: context(language),
      });
    }
    expect(guide.mock.calls[0]![0].language).toBe("zh");
    expect(dining.mock.calls[0]![0].language).toBe("zh");
    expect("language" in guide.mock.calls[1]![0]).toBe(false);
    expect("language" in dining.mock.calls[1]![0]).toBe(false);
  });
});
