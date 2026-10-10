import { describe, expect, it } from "vitest";
import { toAud, type TripBrief } from "@trip/shared";
import { extractBriefPatchLocally } from "../src/chat-offline";
import { applyBriefPatch } from "../src/brief";

const brief: TripBrief = {
  tripId: "chat-test",
  userId: "chat-user",
  destination: "Tokyo",
  dates: ["2026-06-15", "2026-06-22"],
  groupSize: 2,
  budgetTotal: 4000,
};

describe("offline TripBrief extraction", () => {
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

  it("recognises a destination introduced with visit", () => {
    expect(extractBriefPatchLocally("I want to visit Lisbon")).toEqual({ destination: "Lisbon" });
  });

  it("supports incremental destination and budget wording", () => {
    expect(
      extractBriefPatchLocally("Change the destination to Sydney and budget to $3000"),
    ).toEqual({ destination: "Sydney", budgetTotal: 3000 });
  });

  it("does not read 人民币 as a party of 3000", () => {
    const patch = extractBriefPatchLocally("10.6-10.9，预算 3000 人民币");
    expect(patch.groupSize).toBeUndefined();
    expect(patch.budgetTotal).toBe(toAud(3000, "CNY"));
    expect(patch.budgetSource).toEqual({ amount: 3000, currency: "CNY" });
  });

  it("converts a budget stated in another currency and records what was said", () => {
    expect(extractBriefPatchLocally("budget 3000 USD")).toMatchObject({
      budgetTotal: toAud(3000, "USD"),
      budgetSource: { amount: 3000, currency: "USD" },
    });
  });

  it("leaves an unmarked budget alone, because it is already the base currency", () => {
    const patch = extractBriefPatchLocally("budget $3000");
    expect(patch.budgetTotal).toBe(3000);
    expect(patch.budgetSource).toBeUndefined();
  });

  it("keeps unmentioned fields and rejects impossible date ranges", () => {
    expect(applyBriefPatch(brief, { budgetTotal: 3000 }, brief.tripId)).toEqual({
      ...brief,
      budgetTotal: 3000,
    });
    expect(() =>
      applyBriefPatch(brief, { dates: ["2026-02-30", "2026-03-05"] }, brief.tripId),
    ).toThrow("Enter a real date");
    expect(() =>
      applyBriefPatch(brief, { dates: ["2026-10-05", "2026-10-01"] }, brief.tripId),
    ).toThrow("End date must follow start date");
  });
});
